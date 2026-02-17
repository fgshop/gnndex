Pod::Spec.new do |s|
  s.name         = "ReactAppDependencyProvider"
  s.version      = "0.0.1"
  s.summary      = "React Native App Dependency Provider"
  s.homepage     = "https://reactnative.dev/"
  s.license      = "MIT"
  s.author       = "Meta Platforms, Inc."
  s.source       = { :path => "." }
  s.platforms    = { :ios => "15.1" }
  s.source_files = "**/*.{h,mm}"

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "DEFINES_MODULE" => "YES"
  }

  s.dependency "ReactCodegen"
end
