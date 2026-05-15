
// Global - Grab page owner from url
const matchesUser = location.href.match(/(?<=vsco.com?\/).*(?=\/gallery)/);
export const pageOwnerName = matchesUser ? matchesUser[0] : undefined;
