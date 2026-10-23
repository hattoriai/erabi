// "erabi/color": the color picker, for the apps that have one. It takes
// what it shares with the other pickers from "erabi", and registers its
// kind with the hook and the cell editors:
//
//     import { Erabi } from "erabi"
//     import "erabi/color"

import { internal } from "erabi";
import { ColorPicker } from "./colorpicker";

internal.registerKind("color", ColorPicker);

export { ColorPicker };
