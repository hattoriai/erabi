// What the pickers of their own entries ("erabi/color", "erabi/emoji") take from the
// main bundle, so that the page has one copy of each: not Erabi's API.

export { option, readConfig, readValue, sheetOf, Words } from "./config";
export { el, icon } from "./dom";
export { registerKind } from "./kinds";
export { fold, rank } from "./match";
export { writeNative } from "./native";
export { Popup } from "./popup";
export { checkValue } from "./rules";
