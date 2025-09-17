export const countryFlags = {
  // Europe
  SWE: "🇸🇪", // Sweden
  SUI: "🇨🇭", // Switzerland
  NOR: "🇳🇴", // Norway
  FIN: "🇫🇮", // Finland
  FRA: "🇫🇷", // France
  GBR: "🇬🇧", // Great Britain
  DEN: "🇩🇰", // Denmark
  CZE: "🇨🇿", // Czech Republic
  AUT: "🇦🇹", // Austria
  EST: "🇪🇪", // Estonia
  RUS: "🇷🇺", // Russia
  GER: "🇩🇪", // Germany
  ITA: "🇮🇹", // Italy
  ESP: "🇪🇸", // Spain
  BEL: "🇧🇪", // Belgium
  NED: "🇳🇱", // Netherlands
  POL: "🇵🇱", // Poland
  LAT: "🇱🇻", // Latvia
  LTU: "🇱🇹", // Lithuania
  UKR: "🇺🇦", // Ukraine
  BLR: "🇧🇾", // Belarus
  SVK: "🇸🇰", // Slovakia
  SVN: "🇸🇮", // Slovenia
  HUN: "🇭🇺", // Hungary
  ROU: "🇷🇴", // Romania
  BUL: "🇧🇬", // Bulgaria
  CRO: "🇭🇷", // Croatia
  SRB: "🇷🇸", // Serbia
  POR: "🇵🇹", // Portugal
  IRL: "🇮🇪", // Ireland
  ISL: "🇮🇸", // Iceland
  GRE: "🇬🇷", // Greece
  TUR: "🇹🇷", // Turkey

  // Americas
  USA: "🇺🇸", // United States
  CAN: "🇨🇦", // Canada
  BRA: "🇧🇷", // Brazil
  ARG: "🇦🇷", // Argentina
  MEX: "🇲🇽", // Mexico
  CHI: "🇨🇱", // Chile
  COL: "🇨🇴", // Colombia
  VEN: "🇻🇪", // Venezuela

  // Asia-Pacific
  JPN: "🇯🇵", // Japan
  CHN: "🇨🇳", // China
  KOR: "🇰🇷", // South Korea
  AUS: "🇦🇺", // Australia
  NZL: "🇳🇿", // New Zealand
  HKG: "🇭🇰", // Hong Kong
  TPE: "🇹🇼", // Taiwan
  IND: "🇮🇳", // India
  THA: "🇹🇭", // Thailand
  MAS: "🇲🇾", // Malaysia
  SIN: "🇸🇬", // Singapore

  // Africa & Middle East
  RSA: "🇿🇦", // South Africa
  ISR: "🇮🇱", // Israel
  UAE: "🇦🇪", // United Arab Emirates
  EGY: "🇪🇬", // Egypt
  KEN: "🇰🇪", // Kenya
  MAR: "🇲🇦", // Morocco

  // Default fallback
  DEFAULT: "🏳️" // Default flag for unknown countries
};

export const getFlag = (countryCode) => {
  return countryFlags[countryCode] || countryFlags.DEFAULT;
};