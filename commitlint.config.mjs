/** @type {import("@commitlint/types").UserConfig} */
const config = {
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
        "sports",
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

export default config;
