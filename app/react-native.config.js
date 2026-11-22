// La navigation Google n'entre dans la build native que si NAVIGATION_GOOGLE=1.
// Sans ce réglage, la build reste celle d'avant.
const avecNavigation = process.env.NAVIGATION_GOOGLE === '1';

module.exports = {
  dependencies: avecNavigation
    ? {}
    : { '@googlemaps/react-native-navigation-sdk': { platforms: { ios: null, android: null } } },
};
