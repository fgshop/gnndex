#import "RCTAppDependencyProvider.h"
#import <ReactCodegen/RCTModulesConformingToProtocolsProvider.h>

@implementation RCTAppDependencyProvider

- (nonnull NSArray<NSString *> *)URLRequestHandlerClassNames {
  return RCTModulesConformingToProtocolsProvider.URLRequestHandlerClassNames;
}

- (nonnull NSArray<NSString *> *)imageDataDecoderClassNames {
  return RCTModulesConformingToProtocolsProvider.imageDataDecoderClassNames;
}

- (nonnull NSArray<NSString *> *)imageURLLoaderClassNames {
  return RCTModulesConformingToProtocolsProvider.imageURLLoaderClassNames;
}

- (nonnull NSArray<NSString *> *)unstableModulesRequiringMainQueueSetup {
  return @[];
}

- (nonnull NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *)thirdPartyFabricComponents {
  return @{};
}

- (nonnull NSDictionary<NSString *, id<RCTModuleProvider>> *)moduleProviders {
  return @{};
}

@end
