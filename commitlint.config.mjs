/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "auth",
        "db",
        "finance",
        "travel",
        "entertainment",
        "landing",
        "portal",
        "ui",
        "deps",
        "release",
        "ci",
        "docs",
        "config",
        "types",
        "schemas",
      ],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 100],
  },
};
