// DECLARATION ORDER: is every helper written above the function that uses it?
//
// Why this test exists. Every file in src/core starts with 'worklet'; so its
// functions can run on the audio thread and the screen thread. The tool that
// makes that work packs up each function, together with the helpers it uses,
// at the moment the function is created, going down the file from the top.
// A helper written BELOW the function that uses it doesn't exist yet at that
// moment, so on the phone it is missing and the app breaks.
//
// Ordinary JavaScript doesn't care about the order, so every other test here
// would still pass. This one reads the files as text and checks the order.
//
// If it fails: move the helper it names above the function it names.

// This test reads files from the disk, which only works on a computer (never
// in the app itself). The next line tells the type checker that's fine here.
/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const coreFolder = path.join(__dirname, '..');
const coreFiles = fs.readdirSync(coreFolder).filter((name) => name.endsWith('.ts'));

/** Everything a file declares at its top level: name -> where in the file it starts. */
function topLevelDeclarations(file: ts.SourceFile): Map<string, number> {
  const found = new Map<string, number>();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      found.set(statement.name.text, statement.getStart(file));
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          found.set(declaration.name.text, statement.getStart(file));
        }
      }
    }
  }
  return found;
}

/** Names a function makes for itself (its parameters and local variables). */
function localNames(func: ts.FunctionDeclaration): Set<string> {
  const names = new Set<string>();
  function visit(node: ts.Node): void {
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && ts.isIdentifier(node.name)) {
      names.add(node.name.text);
    }
    if (ts.isFunctionDeclaration(node) && node !== func && node.name) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(func);
  return names;
}

/** Is this name being USED as a value here (not a label like `thing.name` or `{ name: 1 }`)? */
function isUseOfAValue(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return false; // the `b` in `a.b`
  }
  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    return false; // the `b` in `{ b: 1 }`
  }
  if (ts.isTypeNode(parent) || ts.isTypeReferenceNode(parent)) {
    return false; // a type, which only exists for the checker
  }
  return true;
}

/** Every "X uses Y, but Y is written below X" in one file's text. */
function problemsIn(fileName: string, text: string): string[] {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const declared = topLevelDeclarations(file);
  const problems: string[] = [];

  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) {
      continue;
    }
    const user = statement.name.text;
    const userStart = statement.getStart(file);
    const locals = localNames(statement);

    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && isUseOfAValue(node)) {
        const helperStart = declared.get(node.text);
        const isHelperBelow = helperStart !== undefined && helperStart > userStart;
        if (isHelperBelow && !locals.has(node.text)) {
          problems.push(`${fileName}: ${user} uses ${node.text}, which is written below it`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(statement.body);
  }
  return problems;
}

describe('helpers are written above the functions that use them', () => {
  test('there are core files to check', () => {
    expect(coreFiles.length).toBeGreaterThan(10);
  });

  test.each(coreFiles)('%s', (fileName) => {
    const text = fs.readFileSync(path.join(coreFolder, fileName), 'utf8');
    expect(problemsIn(fileName, text)).toEqual([]);
  });

  // Proof that the check can fail: a made-up file with the order wrong.
  test('the check does catch a helper written below', () => {
    const wrongOrder = `
      export function double(x: number): number {
        return timesTwo(x);
      }
      function timesTwo(x: number): number {
        return x * 2;
      }
    `;
    expect(problemsIn('made-up.ts', wrongOrder)).toEqual([
      'made-up.ts: double uses timesTwo, which is written below it',
    ]);
  });
});
