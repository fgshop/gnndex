# Testing Patterns - MultiWallet Flutter

## Widget Test Patterns

### Testing Riverpod StateNotifierProvider widgets

- Extend the actual notifier class (e.g., `_TestWalletNotifier extends WalletNotifier`), not `StateNotifier<T>` directly
- `walletStateProvider.overrideWith((ref) => _TestWalletNotifier(walletState))` requires returning the exact provider type
- Create `_NoopSecureStorage implements FlutterSecureStorage` for constructor dependencies

### Testing widgets that use GoRouter

- Wrap in `MaterialApp.router(routerConfig: testRouter)` with a custom GoRouter
- Provide stub routes for ALL navigation targets the widget references (push/go calls)
- Missing routes cause runtime errors, not compile errors

### Handling async delays in widget tests

- `pumpAndSettle()` will TIMEOUT if there are ongoing timers (e.g., `Future.delayed(1200ms)`)
- Use `tester.pump(const Duration(seconds: 2))` to advance past known delays
- The notification prompt in DashboardScreen has a 1200ms Future.delayed -- always advance past it
- TweenAnimationBuilder (800ms in BalanceCard) also contributes to timing

### Constructor side-effects in StateNotifier subclasses

- WalletNotifier constructor calls `_checkExistingWallet()` which is async
- This can race with `state = initial` in test subclass constructors
- Solution: set state AFTER super() call, and don't test states that depend on constructor timing

## Unit Test Patterns

### MockSecureStorage (hand-written, in-memory)

- Implements FlutterSecureStorage interface with internal `Map<String, String>` storage
- All platform-specific options params (IOSOptions, AndroidOptions, etc.) are accepted but ignored
- Use `noSuchMethod` for any unneeded methods: `dynamic noSuchMethod(Invocation inv) => super.noSuchMethod(inv);`

### KeystoreService tests

- Each test needs its own MockSecureStorage + KeystoreService instance (fresh state)
- Password minimum length is 8 chars (from AppConstants.passwordMinLength)
- AES-256-GCM operations are slow in test mode -- each create/unlock ~1-2 seconds

### CryptoUtils tests

- Mnemonic generation is non-deterministic -- test word count and validity, not specific words
- Seed derivation IS deterministic -- same mnemonic always produces same 64-byte seed
- Test each chain's key derivation independently (BTC, ETH, TRX, SOL, BNB)

### Transaction model tests

- Transaction.timestamp is non-nullable DateTime -- never pass null
- TransactionType and TransactionStatus use string matching from JSON with fallback defaults
- Unknown type -> contractCall, unknown status -> pending

## Common Pitfalls

1. `widget_test.dart` must have `void main() {}` even if empty -- missing main causes test runner load failure
2. DashboardScreen was changed from ConsumerWidget to ConsumerStatefulWidget (notification prompt) -- tests must account for this
3. Dashboard has 5 action buttons: Send, Receive, Swap, Stake, History (not 4)
4. Always check if source files were modified externally before writing tests
