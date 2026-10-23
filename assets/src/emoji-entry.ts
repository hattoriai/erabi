// "erabi/emoji": the emoji and icon pickers, for the apps that have one.
// It takes what it shares with the other pickers from "erabi", and
// registers their kinds with the hook and the cell editors:
//
//     import { Erabi } from "erabi"
//     import "erabi/emoji"

import { internal } from "erabi";
import { EmojiPicker } from "./emojipicker";

internal.registerKind("emoji", EmojiPicker);
internal.registerKind("icon", EmojiPicker);

export { EmojiPicker };
