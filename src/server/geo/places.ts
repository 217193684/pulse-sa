/**
 * South African places the classifier can pin a signal to.
 * Coordinates are approximate town centres (good enough for a national heat map).
 * `names` are matched case-sensitively as whole words, longest first, so "Port Elizabeth"
 * beats "Elizabeth" and a town beats its province. Ambiguous everyday words and common
 * first names (George, Alexandra, Springs…) are left out on purpose to avoid false pins.
 */
export type Place = { slug: string; name: string; province: string; lat: number; lon: number; names: string[]; kind: "metro" | "town" | "province" };

const P = (slug: string, name: string, province: string, lat: number, lon: number, names: string[], kind: Place["kind"] = "town"): Place =>
  ({ slug, name, province, lat, lon, names: [name, ...names], kind });

export const PLACES: Place[] = [
  // Metros
  P("johannesburg", "Johannesburg", "GP", -26.204, 28.047, ["Joburg", "Jozi", "City of Johannesburg", "Soweto", "Sandton", "Randburg", "Roodepoort", "Midrand", "Diepsloot", "Orange Farm"], "metro"),
  P("tshwane", "Tshwane", "GP", -25.746, 28.188, ["Pretoria", "Centurion", "Mamelodi", "Soshanguve", "Hammanskraal", "Atteridgeville", "Ga-Rankuwa"], "metro"),
  P("ekurhuleni", "Ekurhuleni", "GP", -26.15, 28.33, ["Germiston", "Benoni", "Boksburg", "Tembisa", "Kempton Park", "Alberton", "Katlehong", "Brakpan", "Daveyton", "Vosloorus", "Thokoza"], "metro"),
  P("cape-town", "Cape Town", "WC", -33.925, 18.424, ["Kaapstad", "City of Cape Town", "Khayelitsha", "Mitchells Plain", "Bellville", "Parow", "Gugulethu", "Nyanga", "Philippi", "Delft", "Langa", "Durbanville", "Atlantis", "Strand", "Somerset West"], "metro"),
  P("ethekwini", "Durban", "KZN", -29.858, 31.022, ["eThekwini", "Umlazi", "KwaMashu", "Pinetown", "Phoenix", "Chatsworth", "Inanda", "Ntuzuma", "Amanzimtoti", "Umhlanga", "Verulam", "Tongaat"], "metro"),
  P("nelson-mandela-bay", "Gqeberha", "EC", -33.961, 25.615, ["Port Elizabeth", "Nelson Mandela Bay", "Kariega", "Uitenhage", "Motherwell", "Despatch"], "metro"),
  P("buffalo-city", "East London", "EC", -33.015, 27.912, ["Buffalo City", "Mdantsane", "Qonce", "King William's Town"], "metro"),
  P("mangaung", "Bloemfontein", "FS", -29.085, 26.159, ["Mangaung", "Botshabelo", "Thaba Nchu"], "metro"),
  // Gauteng towns
  P("west-rand", "Mogale City", "GP", -26.096, 27.77, ["Krugersdorp", "Randfontein", "Westonaria", "Kagiso", "Munsieville"]),
  P("sedibeng", "Vereeniging", "GP", -26.673, 27.926, ["Vanderbijlpark", "Sebokeng", "Evaton", "Sharpeville", "Sedibeng", "Meyerton", "Emfuleni"]),
  // KwaZulu-Natal
  P("msunduzi", "Pietermaritzburg", "KZN", -29.6, 30.379, ["Msunduzi", "Edendale", "Imbali"]),
  P("umhlathuze", "Richards Bay", "KZN", -28.783, 32.038, ["uMhlathuze", "Empangeni", "Esikhawini", "Mandlanzini", "Ngwelezane"]),
  P("newcastle-kzn", "Newcastle", "KZN", -27.758, 29.932, ["Madadeni", "Osizweni"]),
  P("ladysmith", "Ladysmith", "KZN", -28.554, 29.781, ["Emnambithi", "Alfred Duma"]),
  P("port-shepstone", "Port Shepstone", "KZN", -30.741, 30.455, ["Ray Nkonyeni", "Margate"]),
  P("ballito", "Ballito", "KZN", -29.539, 31.214, ["KwaDukuza", "Stanger"]),
  P("vryheid", "Vryheid", "KZN", -27.769, 30.791, ["Ulundi"]),
  // Western Cape
  P("stellenbosch", "Stellenbosch", "WC", -33.932, 18.86, ["Kayamandi"]),
  P("paarl", "Paarl", "WC", -33.734, 18.962, ["Drakenstein", "Wellington", "Mbekweni"]),
  P("worcester", "Worcester", "WC", -33.646, 19.448, ["Breede Valley"]),
  P("mossel-bay", "Mossel Bay", "WC", -34.183, 22.146, ["KwaNonqaba"]),
  P("knysna", "Knysna", "WC", -34.035, 23.048, ["Plettenberg Bay"]),
  P("oudtshoorn", "Oudtshoorn", "WC", -33.592, 22.203, []),
  P("saldanha", "Saldanha", "WC", -33.011, 17.944, ["Vredenburg"]),
  // Eastern Cape
  P("mthatha", "Mthatha", "EC", -31.589, 28.784, ["Umtata", "King Sabata Dalindyebo"]),
  P("komani", "Komani", "EC", -31.897, 26.875, ["Queenstown"]),
  P("makhanda", "Makhanda", "EC", -33.31, 26.526, ["Grahamstown"]),
  P("butterworth", "Butterworth", "EC", -32.33, 28.15, ["Gcuwa"]),
  // Free State
  P("welkom", "Welkom", "FS", -27.977, 26.735, ["Matjhabeng", "Thabong", "Odendaalsrus"]),
  P("bethlehem", "Bethlehem", "FS", -28.231, 28.307, []),
  P("sasolburg", "Sasolburg", "FS", -26.814, 27.817, ["Zamdela", "Metsimaholo"]),
  P("qwaqwa", "Phuthaditjhaba", "FS", -28.53, 28.816, ["QwaQwa"]),
  // Limpopo
  P("polokwane", "Polokwane", "LP", -23.904, 29.469, ["Pietersburg", "Seshego"]),
  P("thohoyandou", "Thohoyandou", "LP", -22.95, 30.484, ["Thulamela"]),
  P("tzaneen", "Tzaneen", "LP", -23.833, 30.163, ["Greater Tzaneen"]),
  P("musina", "Musina", "LP", -22.352, 30.036, ["Beitbridge"]),
  P("mokopane", "Mokopane", "LP", -24.194, 29.01, ["Mogalakwena", "Potgietersrus"]),
  P("lephalale", "Lephalale", "LP", -23.678, 27.7, ["Ellisras"]),
  // Mpumalanga
  P("mbombela", "Mbombela", "MP", -25.475, 30.97, ["Nelspruit", "KaNyamazane"]),
  P("emalahleni", "eMalahleni", "MP", -25.871, 29.233, ["Witbank", "KwaGuqa"]),
  P("middelburg-mp", "Middelburg", "MP", -25.775, 29.464, ["Steve Tshwete", "Mhluzi"]),
  P("secunda", "Secunda", "MP", -26.517, 29.183, ["Govan Mbeki", "Embalenhle"]),
  P("ermelo", "Ermelo", "MP", -26.523, 29.986, ["Msukaligwa"]),
  P("bushbuckridge", "Bushbuckridge", "MP", -24.84, 31.07, []),
  // North West
  P("rustenburg", "Rustenburg", "NW", -25.667, 27.242, ["Bojanala", "Marikana", "Phokeng", "Boitekong"]),
  P("mahikeng", "Mahikeng", "NW", -25.865, 25.644, ["Mafikeng", "Mmabatho"]),
  P("klerksdorp", "Klerksdorp", "NW", -26.852, 26.667, ["Matlosana", "Jouberton"]),
  P("potchefstroom", "Potchefstroom", "NW", -26.715, 27.103, ["JB Marks", "Ikageng"]),
  P("brits", "Brits", "NW", -25.634, 27.78, ["Madibeng", "Hartbeespoort"]),
  // Northern Cape
  P("kimberley", "Kimberley", "NC", -28.738, 24.763, ["Sol Plaatje", "Galeshewe"]),
  P("upington", "Upington", "NC", -28.448, 21.256, ["Dawid Kruiper"]),
  P("springbok", "Springbok", "NC", -29.664, 17.886, ["Namakwa"]),
  P("kuruman", "Kuruman", "NC", -27.452, 23.432, []),
  // Provinces (used when only the province is named)
  P("gauteng", "Gauteng", "GP", -26.1, 28.1, [], "province"),
  P("kwazulu-natal", "KwaZulu-Natal", "KZN", -29.0, 30.9, ["KZN"], "province"),
  P("western-cape", "Western Cape", "WC", -33.3, 19.9, [], "province"),
  P("eastern-cape", "Eastern Cape", "EC", -32.3, 26.8, [], "province"),
  P("free-state", "Free State", "FS", -28.6, 26.8, [], "province"),
  P("limpopo", "Limpopo", "LP", -23.6, 29.6, [], "province"),
  P("mpumalanga", "Mpumalanga", "MP", -25.8, 30.2, [], "province"),
  P("north-west", "North West", "NW", -26.3, 25.9, [], "province"),
  P("northern-cape", "Northern Cape", "NC", -29.5, 21.9, [], "province"),
];

export const PLACE_BY_SLUG = new Map(PLACES.map((p) => [p.slug, p]));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** All aliases, longest first, each with its place: the first match in this order wins. */
const ALIASES = PLACES.flatMap((p) => p.names.map((n) => ({ n, p })))
  .sort((a, b) => b.n.length - a.n.length || (a.p.kind === "province" ? 1 : 0) - (b.p.kind === "province" ? 1 : 0));
const ALIAS_RE = ALIASES.map(({ n, p }) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, "u"), p }));

/** The most specific place named in the text, or null. Towns win over provinces. */
export function findPlace(text: string): Place | null {
  let province: Place | null = null;
  for (const { re, p } of ALIAS_RE) {
    if (!re.test(text)) continue;
    if (p.kind !== "province") return p;
    province ??= p;
  }
  return province;
}
