#import "ReactAppDependencyProvider.h"
#import <ReactCodegen/RCTModulesConformingToProtocolsProvider.h>
#import <ReactCodegen/RCTThirdPartyComponentsProvider.h>

@implementation ReactAppDependencyProvider

- (nonnull NSDictionary<NSString *,Class<RCTComponentViewProtocol>> *)thirdPartyFabricComponents
{
  return @{};
}

- (nonnull NSDictionary<NSString *,Class> *)thirdPartyModulesForContext:(nonnull NSString *)context
{
  return @{};
}

@end
