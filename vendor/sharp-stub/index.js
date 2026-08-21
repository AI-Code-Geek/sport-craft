// See package.json's description — this stands in for the real `sharp` package, which this app
// never actually invokes (images.unoptimized: true means Next's image optimizer, the only thing
// that would call sharp, is never reached at runtime).
function sharp() {
	throw new Error(
		"sharp-stub: the real `sharp` package is intentionally not installed (see vendor/sharp-stub) " +
			"— this app has images.unoptimized: true and should never actually call sharp at runtime. " +
			"If you're seeing this, something is calling sharp() unexpectedly.",
	);
}

module.exports = sharp;
module.exports.default = sharp;
