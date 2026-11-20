# Tells the iOS build that this folder is a small native library and what it needs.
Pod::Spec.new do |s|
  s.name           = 'AsunderHaptics'
  s.version        = '1.0.0'
  s.summary        = 'Asunder haptics'
  s.description    = 'The tick and lock haptics for the Asunder dial, played with Core Haptics.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreHaptics'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift}"
end
