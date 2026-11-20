import SwiftUI

/// App entry point. iOS starts here and shows ContentView.
@main
struct AsunderApp: App {
    /// The bench is made exactly once, here.
    @State private var bench = Bench()

    var body: some Scene {
        WindowGroup {
            ContentView(bench: bench)
        }
    }
}
