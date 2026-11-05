export default {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Only strip what Devvit's SVG sanitizer rejects. Keep the path `d`
          // geometry and element transforms byte-for-byte identical so the
          // icons render exactly as the originals (convertPathData /
          // convertTransform can subtly alter curves and break hover-rotated
          // icons such as close/cancel).
          convertStyleToAttrs: true,
          convertTransform: false,
          convertPathData: false,
          removeViewBox: false,
          removeXMLNS: false,
          cleanupIDs: { remove: true, preserve: [], minify: false },
          removeMetadata: true,
          removeEditorsNSData: true,
          removeXMLProcInst: true,
          removeUnknownsAndDefaults: false,
          removeUselessDefs: false,
        },
      },
    },
    { name: 'removeXlink' },
  ],
};
