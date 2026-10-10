/**
 * The docs' code theme. Code blocks are dark in both modes, so one theme does:
 * white keywords and tags, blue attributes, green strings, zinc text.
 */
export const codeTheme = {
  name: "intentface-code",
  type: "dark" as const,
  colors: {
    "editor.background": "#00000000",
    "editor.foreground": "#d4d4d8",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#71717a", fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "storage.modifier",
        "variable.language",
        "entity.name.tag",
        "support.class.component",
        "entity.name.type",
        "entity.name.class",
        "support.type.primitive",
      ],
      settings: { foreground: "#ffffff" },
    },
    {
      scope: ["entity.other.attribute-name", "support.type.property-name", "meta.object-literal.key"],
      settings: { foreground: "#9cc2f5" },
    },
    {
      scope: ["string", "string.quoted", "string.template", "punctuation.definition.string"],
      settings: { foreground: "#a6d7b8" },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "#f0c38e" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#e4e4e7" },
    },
  ],
};
