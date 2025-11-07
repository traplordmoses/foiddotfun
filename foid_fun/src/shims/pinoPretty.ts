/**
 * Minimal client-safe stub for pino-pretty so WalletConnect's logger
 * can bundle without pulling optional Node streams into the browser.
 */
function createNoopStream() {
  return {
    pipe: () => createNoopStream(),
    on: () => createNoopStream(),
    once: () => createNoopStream(),
    emit: () => false,
    end: () => undefined,
  };
}

function pinoPretty() {
  return createNoopStream();
}

export default pinoPretty;
module.exports = pinoPretty;
module.exports.default = pinoPretty;
