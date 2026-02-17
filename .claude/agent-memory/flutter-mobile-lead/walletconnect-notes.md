# WalletConnect v2 Integration Notes

## Package: reown_walletkit ^1.3.8

- Formerly `walletconnect_flutter_v2`, now `reown_walletkit` (Reown brand)
- Re-exports: `reown_core` (PairingMetadata, Errors, JsonRpcResponse, etc.) and `reown_sign` (SessionData, RequiredNamespace, Namespace, etc.)

## API Type Gotchas (CRITICAL)

- `Errors.getSdkError()` returns `ReownCoreError`, but `rejectSession()` and `disconnectSession()` expect `ReownSignError`
- Must convert: `ReownSignError(code: coreError.code, message: coreError.message)`
- `IReownSignWallet` (wallet side) does NOT have `onSessionUpdate` -- that's on `IReownSignClient` (app/DApp side)
- Use `onSessionConnect` instead for tracking new sessions on the wallet side
- `ProposalData.optionalNamespaces` is `required Map<String, RequiredNamespace>` (non-nullable) -- use `.isNotEmpty` not `!= null`
- `PairingMetadata` and `RequiredNamespace` are from reown_core/reown_sign but re-exported via `reown_walletkit`
- UI files need `import 'package:reown_walletkit/reown_walletkit.dart'` for type access

## Event Streams Available on IReownSignWallet

- `onSessionProposal` (Event<SessionProposalEvent>)
- `onSessionProposalError` (Event<SessionProposalErrorEvent>)
- `onSessionRequest` (Event<SessionRequestEvent>)
- `onSessionAuthRequest` (Event<SessionAuthRequest>)
- From IReownSignCommon: `onSessionConnect`, `onSessionDelete`, `onSessionExpire`, `onSessionPing`

## Supported Methods (EVM)

- eth_sendTransaction, personal_sign, eth_sign
- eth_signTypedData_v4, eth_signTypedData, eth_signTransaction

## CAIP Formats

- Chain ID (CAIP-2): `eip155:1` (Ethereum), `eip155:56` (BNB), `eip155:137` (Polygon)
- Account ID (CAIP-10): `eip155:1:0xABC...`

## Project ID

- Obtain from https://cloud.reown.com
- Required for relay server auth; placeholder `YOUR_PROJECT_ID_HERE` in code
- Free tier available

## Architecture Decision

- Service layer: raw WalletKit wrapper with StreamControllers
- Provider layer: StateNotifier with WalletConnectState (isInitialized, isLoading, activeSessions, pendingProposal, pendingRequest, error)
- Sign request approval: bottom sheet with biometric gate, placeholder signature (production needs actual signing)
