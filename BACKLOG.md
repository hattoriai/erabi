# Backlog

Known gaps in Erabi, each to become an issue.

## A bottom sheet on phones

The popup is a dropdown on every screen. On a narrow screen, a sheet
from the bottom with a large box to search in (Koyomi's popover becomes
one), and tests on phones.

## Item-aligned lists

A select's list placed over the field, with the chosen option where the
field shows it (macOS, Radix), on desktop.

## Editing options

Rename, recolor, reorder and delete options in the list, as Notion's
select does, as events to the LiveView; the app keeps the options.

## Rows of the app's own

A slot that draws a whole option row, for options that are more than a
label, a picture and a hint (a repository with its stars).

## A status picker

A select whose options have groups that mean something (to do, in
progress, done), as Notion's status: the groups' colors and order.

## Masu's cells in color

Masu shows a column's values as text; with `Erabi.Option`'s colors, its
cells could show the same chips as the picker.

## Kotoba's prompts on Erabi's list

Kotoba's prompts (`@`, `:`, `+`) have their own list, filter and search
protocol. They could use Erabi's list controller and search, as Jumon's
palette could, once the list controller is a shared package (see the
Jumon matcher note below).

## One matcher for the family

`Erabi.Match` and `match.ts` are Jumon's, kept the same by Jumon's
fixture. A small shared package of the matcher and the list controller
would keep one copy.

## Scripts without spaces

`Intl.Segmenter` for words in Japanese and Chinese names, as Jumon's
backlog has it.
