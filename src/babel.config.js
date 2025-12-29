module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // Use the Expo Babel preset to make Jest understand and run Expo package code.
  };
};