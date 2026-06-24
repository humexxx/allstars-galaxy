# Changelog

## [0.4.0](https://github.com/humexxx/allstars-galaxy/compare/v0.3.0...v0.4.0) (2026-06-24)


### Features

* **finance:** chart past from real snapshots + calibrated forecast future ([9dd3dd6](https://github.com/humexxx/allstars-galaxy/commit/9dd3dd6a2b492936d814dbcce4ce30b953e4d7cf))
* **finance:** real snapshots, auto-confirm, chart hover preview + plan UI refresh ([8c3c8b7](https://github.com/humexxx/allstars-galaxy/commit/8c3c8b710a3c85fb54881d21e8a300eeb8d116da))
* **portal:** shared nav config powering sidebar, header and command menu ([fcc55bd](https://github.com/humexxx/allstars-galaxy/commit/fcc55bde0454b7a26f08437d66a956e8d10239a6))


### Bug Fixes

* **db:** recycle pooled connections to avoid statement-timeout hangs ([708b8be](https://github.com/humexxx/allstars-galaxy/commit/708b8be90710d2da93d7367fa44af47fcbb22147))
* **entertainment:** repair public trip shares and knockout brackets, standardize sports styles ([44c84b1](https://github.com/humexxx/allstars-galaxy/commit/44c84b1752a58b59ed41a31f53bf6be97e954e20))


### Refactor

* **ui:** standardize typography and spacing across landing, portal and modules ([b823a79](https://github.com/humexxx/allstars-galaxy/commit/b823a79a1f5999373595bed65870bb1f67899984))

## [0.3.0](https://github.com/humexxx/allstars-galaxy/compare/v0.2.0...v0.3.0) (2026-06-03)


### Features

* **finance:** add confirmation-day-anchored period helpers ([b375695](https://github.com/humexxx/allstars-galaxy/commit/b375695b9143aeb6450acea5476817889f940ee7))
* **finance:** Anchored / Month toggle in the Calendar tab ([db6d43f](https://github.com/humexxx/allstars-galaxy/commit/db6d43f95dd99f4d1accb415aa53e990f34a5379))
* **finance:** bucket confirmations by period anchor ([9c4de91](https://github.com/humexxx/allstars-galaxy/commit/9c4de91f0a9f375d6de0633ae4e34e7ec5700aa3))
* **finance:** compact 2x2 KPI layout for plan Overview on mobile ([bc81f52](https://github.com/humexxx/allstars-galaxy/commit/bc81f522d4a5bfb778151ddab332edd8f488bf33))
* **finance:** dev-tools action to force the confirmation dialog ([7e11653](https://github.com/humexxx/allstars-galaxy/commit/7e116534ffff216695b7b5d74998c96cbfe858e9))
* **finance:** dev-tools action to run the daily snapshot job on demand ([a5090ae](https://github.com/humexxx/allstars-galaxy/commit/a5090aecc5eb84cbe89651aa174d536c13b43cdf))
* **finance:** horizontal KPI rail + period-aware wording on Overview ([86e2855](https://github.com/humexxx/allstars-galaxy/commit/86e2855ed1147c323d0811630c64b69f2b314399))
* **finance:** main plan concept + strict confirmation-day check ([004df7e](https://github.com/humexxx/allstars-galaxy/commit/004df7e212268505afbab7ad3e5e523f40a53a07))
* **finance:** pin compact health gauge to the title's top-right on mobile ([0717e48](https://github.com/humexxx/allstars-galaxy/commit/0717e48047c1cb3419a88b277cd5da45aec262f8))
* **finance:** pin the strategy picker to the projection card's top-right on mobile ([ae69c0c](https://github.com/humexxx/allstars-galaxy/commit/ae69c0c6bec56ea4a9a16a2dca0317f5e06d921b))
* **finance:** project plan by confirmation-day anchored periods ([1e62da5](https://github.com/humexxx/allstars-galaxy/commit/1e62da53bd47f5ffbcfb68708458806254a0886a))
* **ui:** disable document overscroll bounce on the app shell ([670de86](https://github.com/humexxx/allstars-galaxy/commit/670de867eb490828c10c3ccc0c4833a191bf7dac))
* **ui:** landing + auth + portfolio refresh, dev-tools drawer, app-shell polish ([61ac06c](https://github.com/humexxx/allstars-galaxy/commit/61ac06c7aeafc86b79f7697a1556dfb7aea9f58a))
* **ui:** landing + auth + portfolio refresh, dev-tools drawer, app-shell polish ([13d3778](https://github.com/humexxx/allstars-galaxy/commit/13d37786158bf6ac8a971c054d38f2fb3c3c9534))
* **ui:** scale typography down on mobile (responsive heading scale) ([c05947f](https://github.com/humexxx/allstars-galaxy/commit/c05947f1217be2c68ab6cb5dd825cb356ff4fee9))


### Bug Fixes

* **config:** move pnpm build allowlist to pnpm-workspace.yaml ([ab8eb03](https://github.com/humexxx/allstars-galaxy/commit/ab8eb03c2bbd5b373a1a353a09b92e47df423bf9))
* **db:** repair daily portfolio snapshots broken by ANY(tuple) query ([f07998f](https://github.com/humexxx/allstars-galaxy/commit/f07998f9aea3f1d4e2248beb8f9cbf8abbae16cb))
* **finance:** align KPI rail with the page + bump mobile gauge to 96px ([36c4f9f](https://github.com/humexxx/allstars-galaxy/commit/36c4f9f585a212d35ae70ed4f7c74e140c9085ec))
* **finance:** align plan-detail skeleton with the new header + KPI rail ([fbf92c3](https://github.com/humexxx/allstars-galaxy/commit/fbf92c32c0a00e8b1391889590abd28c64decab9))
* **finance:** re-show confirmation dialog daily until filled ([e8707c5](https://github.com/humexxx/allstars-galaxy/commit/e8707c5ef05b676aac730c7a8b2b45a73015c881))
* **finance:** restore KPI rail's bottom gap to the projection panel ([8cff052](https://github.com/humexxx/allstars-galaxy/commit/8cff0520209b38545a5cd4a4fc2ee47c5198b2ca))
* **finance:** stop the KPI rail clipping each card's top border ([d30ceee](https://github.com/humexxx/allstars-galaxy/commit/d30ceeef6fa9fb354b9c52872e0704aef3012ef3))

## [0.2.0](https://github.com/humexxx/allstars-galaxy/compare/v0.1.0...v0.2.0) (2026-05-26)


### Features

* add `users` table, foreign key to `auth.users`, and a trigger for data synchronization ([e911d04](https://github.com/humexxx/allstars-galaxy/commit/e911d0497a9ed8acd594d9bb76941087264ebf67))
* add Admin Users page and enhance sidebar navigation for admin role ([374a2eb](https://github.com/humexxx/allstars-galaxy/commit/374a2eb99ac4d4363758dfc9585bf16c48f57f08))
* add AI agent instructions and guidelines; enhance sidebar component structure and styling ([c0a4cee](https://github.com/humexxx/allstars-galaxy/commit/c0a4cee33b786bc2b0ad29c216e182c1f15e1038))
* add AppSidebar component with user navigation, month picker, and new calendar creation. ([bc40b4b](https://github.com/humexxx/allstars-galaxy/commit/bc40b4bec07f9fefa76bf6399b79598cdcf8e7f2))
* add board and road path schemas with validation ([22300bc](https://github.com/humexxx/allstars-galaxy/commit/22300bc9ee7b90278d792d2266f1fb85ca844d60))
* Add drizzle-kit as a dev dependency. ([2077154](https://github.com/humexxx/allstars-galaxy/commit/20771542f8ceaee6366650472c1fa28d0c6d0d9f))
* Add drizzle-kit as a dev dependency. ([b8c922d](https://github.com/humexxx/allstars-galaxy/commit/b8c922d82ede08dbb0e5ea027112b1d37b197020))
* add finance snapshot schema and related types ([7934eeb](https://github.com/humexxx/allstars-galaxy/commit/7934eebfbf7a722d4e3957b21bb05c91f47e2f52))
* add full service + action test coverage, ci workflow, and ui fixes ([1a20942](https://github.com/humexxx/allstars-galaxy/commit/1a2094224baffc5a477ff400422a9941856131c1))
* Add initial set of UI components, application layout, and core pages. ([d2632c8](https://github.com/humexxx/allstars-galaxy/commit/d2632c8003854ca1207f213da469b94022744ef4))
* add landing page components and illustrations ([efe1a7b](https://github.com/humexxx/allstars-galaxy/commit/efe1a7bcf755876a411ef36ba9b64a213e9ecf94))
* add mounted state to NavUser component for improved rendering; prevent UI flicker on initial load ([6b08454](https://github.com/humexxx/allstars-galaxy/commit/6b08454238addd3f40d645977752528eb0e224c4))
* Add new `Button` UI component. ([1d610fd](https://github.com/humexxx/allstars-galaxy/commit/1d610fd371dfae3e654f3abb9aaf5f597a2b97dc))
* add skills for database migration, server action creation, and service creation ([e36e29e](https://github.com/humexxx/allstars-galaxy/commit/e36e29ece27c50780149eea777f9c12e7019ca39))
* add snapshot source enum and update portfolio snapshots schema ([ee04b09](https://github.com/humexxx/allstars-galaxy/commit/ee04b09b7c6341d4c931c44192f8c19692d91489))
* add Task Board and Road Paths pages; implement Checkbox component and update schemas with new fields ([1515dd7](https://github.com/humexxx/allstars-galaxy/commit/1515dd73ca5846296403876ddbfcdeaa9c2e4ecf))
* add task priority to board tasks and update related schemas ([36a31dd](https://github.com/humexxx/allstars-galaxy/commit/36a31dd22c6668ad6f9ea8c9a5c1196f56f10781))
* add testing setup with Vitest and Playwright ([2717095](https://github.com/humexxx/allstars-galaxy/commit/271709500b6db0a347a3829b14c9ac4baafad34c))
* add transaction schema and types ([3de2014](https://github.com/humexxx/allstars-galaxy/commit/3de2014ec327194c050a36a8d72ded7795e62c38))
* add transactions to db ([28cf6aa](https://github.com/humexxx/allstars-galaxy/commit/28cf6aabda2db0ae9dc1854fd359aaa83a0f44af))
* add user authentication features including login, signup, and password reset. ([7922b18](https://github.com/humexxx/allstars-galaxy/commit/7922b181b0f7b236dda3c304f49a69d408c027ad))
* add user role management and impersonation logging ([a5d225b](https://github.com/humexxx/allstars-galaxy/commit/a5d225b819ee9100eb30e40f59d1644ffbc7e09d))
* add UserSelector component for improved user selection; update portfolio header and transaction form to utilize new component ([b4db898](https://github.com/humexxx/allstars-galaxy/commit/b4db8980638effc0c584e51554b672e38ffa3590))
* **auth:** add server-side signOutAction and wire nav-user to it ([6de3f73](https://github.com/humexxx/allstars-galaxy/commit/6de3f732c3c954c65abc16756958885c930e95c3))
* **auth:** enhance login and signup flows with next parameter handling ([406a36c](https://github.com/humexxx/allstars-galaxy/commit/406a36c40545e9027a122d6a930608f0576cb684))
* **db:** add recurrence-type columns to finance plan lines ([a9f8266](https://github.com/humexxx/allstars-galaxy/commit/a9f8266e2801e315bbd34a1ae2d1d27010df89f5))
* **db:** finance_plan_line_overrides table for per-month edits ([1d4a1ff](https://github.com/humexxx/allstars-galaxy/commit/1d4a1ffe813ad26222347df0f97a0d17e22425f4))
* enhance date selection in manual snapshot and transaction forms with future date validation ([7b64d5e](https://github.com/humexxx/allstars-galaxy/commit/7b64d5ee55e69c2d96d72684ef91115e794ad81b))
* enhance EmptyPortfolio component with new design and shadcn/ui integration; update database schema for portfolio snapshots ([03b6075](https://github.com/humexxx/allstars-galaxy/commit/03b6075d891b134e96946abd3cd034ad23c34838))
* enhance manual snapshot deletion to support all portfolios; update UI text for clarity and improve user feedback ([2c6915b](https://github.com/humexxx/allstars-galaxy/commit/2c6915ba96ccb7a88f72eff96d3cdae4b8593454))
* enhance portal layout and add new page container component; improve transaction and portfolio management UI ([0e01ffa](https://github.com/humexxx/allstars-galaxy/commit/0e01ffa87386a4fe0f0d7396346852b07a5320f2))
* enhance portfolio management features ([dfd149a](https://github.com/humexxx/allstars-galaxy/commit/dfd149a18651832718cc20ae8dda6bb0cd0b54b7))
* enhance portfolio page to support admin user selection; update portfolio client and add transaction dialog for user context ([e28c072](https://github.com/humexxx/allstars-galaxy/commit/e28c0727c1fb8145f2947f72da5e5c116810d154))
* enhance portfolio statistics and charts with investment methods and active transactions ([0d6d8ea](https://github.com/humexxx/allstars-galaxy/commit/0d6d8ea417232a306825a4fb116f19cbc6396744))
* enhance transaction approval and manual snapshot creation; utilize transaction date for snapshots and improve user feedback ([4c594fb](https://github.com/humexxx/allstars-galaxy/commit/4c594fbfc4360910d7c571981154bd264e82c16b))
* enhance transaction creation with admin approval logic and snapshot creation; improve interest application with date filtering ([1be5e6b](https://github.com/humexxx/allstars-galaxy/commit/1be5e6b306b54499804e9ea17d5e62cbac007fc3))
* enhance transaction management with approval/rejection tracking and UI updates ([f221c0a](https://github.com/humexxx/allstars-galaxy/commit/f221c0a8a22a089ab16196efa98fd292797f8f7a))
* enhance transaction management with user role validation and user selection for admin ([7726a28](https://github.com/humexxx/allstars-galaxy/commit/7726a2854fff8e2f4b9df55158302cb3d294c2b6))
* **entertainment:** add Sports hub with scores, standings and brackets ([afcb32d](https://github.com/humexxx/allstars-galaxy/commit/afcb32def99ba3527e82e719013f9ccab9cbadfb))
* **entertainment:** add travel planner with shareable trip pages ([bd19f0c](https://github.com/humexxx/allstars-galaxy/commit/bd19f0c4d4f197194c0e5a259128a38754eec342))
* **entertainment:** expose Sports in sidebar nav and types barrel ([0141dae](https://github.com/humexxx/allstars-galaxy/commit/0141daeea6fa00f3daa6828263b0b16c8a7dd577))
* **finance:** "Edit details…" option in the drag prompt ([9c85509](https://github.com/humexxx/allstars-galaxy/commit/9c855095ab274088d8d86f6c761eba960f6ed067))
* **finance:** add day total to "+N more" tooltip ([7e5f5c9](https://github.com/humexxx/allstars-galaxy/commit/7e5f5c93fb53498c983ce2d403f8d044688812a6))
* **finance:** add finance schemas and types ([c22fa4a](https://github.com/humexxx/allstars-galaxy/commit/c22fa4a5f88966b46fe71f4c30f06593c8530bee))
* **finance:** add schemas for income and expense plans with validation rules ([4c2a7ff](https://github.com/humexxx/allstars-galaxy/commit/4c2a7ff0f81eec090e18d98c5f3f11843ecabf6c))
* **finance:** animate gauge percent label alongside the needle ([ae836ed](https://github.com/humexxx/allstars-galaxy/commit/ae836edb5ed04d902bb8a2ff94ef1bf45cad5b4c))
* **finance:** animate health gauge needle sweep-in on mount and updates ([88ed442](https://github.com/humexxx/allstars-galaxy/commit/88ed442d63e2cb3fdf9e85d929ecf1bf21ccf617))
* **finance:** day-aware interest accrual using the calendar's payment day ([24321de](https://github.com/humexxx/allstars-galaxy/commit/24321de88b9325453dd3b1b2c64cde756664eb6f))
* **finance:** drag prompt asks "move all" vs "just this month" ([9898036](https://github.com/humexxx/allstars-galaxy/commit/9898036b2e123559358999a528a2d1ceac7c7a98))
* **finance:** expand calendar cells in place and drag entries between days ([1bb402a](https://github.com/humexxx/allstars-galaxy/commit/1bb402a09344cba257add44bde49a9ce549efc6e))
* **finance:** expand calendar day to view and edit income/expense/debt ([33cf0e1](https://github.com/humexxx/allstars-galaxy/commit/33cf0e104d6279a686c807771b5deb9b362ede2f))
* **finance:** expand/collapse calendar day by clicking the cell ([848bbf2](https://github.com/humexxx/allstars-galaxy/commit/848bbf210fb671b2ef33f45c11b9ce2338b592ae))
* **finance:** expose recurrence types in the form UI ([ea06ca8](https://github.com/humexxx/allstars-galaxy/commit/ea06ca8abb72e93bff3f7a61d93721f62ff48e5e))
* **finance:** focus projection chart on net worth with past/future split ([71ca1b4](https://github.com/humexxx/allstars-galaxy/commit/71ca1b4c640802f03a7b08c64b81bd9f4ef374ad))
* **finance:** group schedule fields in line and debt dialogs ([530a328](https://github.com/humexxx/allstars-galaxy/commit/530a3289e1c18ed91281414969b96ac01a095512))
* **finance:** honour per-month overrides in projection + calendar ([1479788](https://github.com/humexxx/allstars-galaxy/commit/1479788a7f7b442fce76619dcd97a4c5d834b56d))
* **finance:** honour recurrence type in monthly projection ([87f79d0](https://github.com/humexxx/allstars-galaxy/commit/87f79d00593fb7c50b54752870b99058f5b71aa3))
* **finance:** horizon presets back in projection header (12 mo / 2 / 5 / 10 yr) ([acb0b00](https://github.com/humexxx/allstars-galaxy/commit/acb0b004c2a61c081d32723c22102d0e68485a4a))
* **finance:** merge debt strategy into projection card + click to switch ([21310fc](https://github.com/humexxx/allstars-galaxy/commit/21310fc03904f6f7860b49e1d8efebfd054d5a6d))
* **finance:** milestone labels carry a "how far from today" tooltip ([bf389f2](https://github.com/humexxx/allstars-galaxy/commit/bf389f2d5b17168ff11a33bcde35c5d5ed51f66a))
* **finance:** open calendar on current month + pill-style "today" ([83be296](https://github.com/humexxx/allstars-galaxy/commit/83be29639de5d393d0aa7234efff86463d0822a2))
* **finance:** per-chip override menu (skip / reset / edit) ([2d3d735](https://github.com/humexxx/allstars-galaxy/commit/2d3d73523e56e4e01bc9ab957adcfad4e5e8c100))
* **finance:** persist recurrence fields through CRUD + clone ([768245d](https://github.com/humexxx/allstars-galaxy/commit/768245d859c79fb28e77b0f03007e41ff1a49eeb))
* **finance:** render new recurrence types in calendar grid + summary ([e835023](https://github.com/humexxx/allstars-galaxy/commit/e83502370c4908001f16069d9b6306b5f3434508))
* **finance:** replace gauge A/B + add calendar month summary ([8c7b955](https://github.com/humexxx/allstars-galaxy/commit/8c7b95530614445d28a734aad2cba1ee46aaf91d))
* **finance:** rich tooltip on each calendar entry ([8a98742](https://github.com/humexxx/allstars-galaxy/commit/8a987420b59c20c12325037c8c707ea7c2333e7c))
* **finance:** show hidden entries in tooltip on "+N more" ([acbb671](https://github.com/humexxx/allstars-galaxy/commit/acbb671a189470ae8e58ee8d69a8cb910e3e5a9f))
* **finance:** track due day of month on plan debts ([b5cab81](https://github.com/humexxx/allstars-galaxy/commit/b5cab81e9545fb1d21bc76ac9ac96bceb1d1fa7a))
* **finance:** two-line chips with click-to-edit and hold-to-drag ([a1a3b1b](https://github.com/humexxx/allstars-galaxy/commit/a1a3b1b7cfb96deaf21b6dc1234e5a24227043b5))
* **finance:** zod schemas + pass-through types for recurrence fields ([4c97586](https://github.com/humexxx/allstars-galaxy/commit/4c975867a61c4b5eed5f7f317ed1422fea82a0f9))
* follow better practices for ui ([ef7d5dd](https://github.com/humexxx/allstars-galaxy/commit/ef7d5ddd076b3d68155c61667c2140216f54bda4))
* implement admin transaction management ([2ab654c](https://github.com/humexxx/allstars-galaxy/commit/2ab654cf8a25b26b71e7265f77374b55f8d628cc))
* implement board and road path features ([8cb7c21](https://github.com/humexxx/allstars-galaxy/commit/8cb7c21e7667bbb26c24cc1a9cc52fb9819a2fa1))
* Implement database seeding and Drizzle ORM connection with a new `db:seed` script. ([762a95b](https://github.com/humexxx/allstars-galaxy/commit/762a95b06860c15cbff65aa9213e5e95002b2871))
* implement manual snapshot creation and approval snapshot functionality ([0d46ec5](https://github.com/humexxx/allstars-galaxy/commit/0d46ec55a4407d0feabdf7b1ec7a7e80ca05775c))
* implement manual snapshot creation with validation and enhanced schema management ([0f4da3d](https://github.com/humexxx/allstars-galaxy/commit/0f4da3d1881bbd2dabd4256186ad89a8fbd6dfb5))
* Implement Supabase authentication with dedicated login/signup pages, forms, middleware, and client/server utilities. ([d3ba6cc](https://github.com/humexxx/allstars-galaxy/commit/d3ba6ccf6cf7d7e07fcaf77d5c3fceb9bc77e9a1))
* implement typography system and integrate Geist fonts ([6799c40](https://github.com/humexxx/allstars-galaxy/commit/6799c40fe19c5c6a7f85dd3c062d11b9dc8edbff))
* Initialize Next.js project with core structure, shadcn/ui components, and essential utilities. ([3860c3e](https://github.com/humexxx/allstars-galaxy/commit/3860c3e7e5024fa60746ec5172053b1d2aea205f))
* integrate cmdk for command palette functionality; update package dependencies ([49a2f82](https://github.com/humexxx/allstars-galaxy/commit/49a2f827df37994c02d33748aba1d85cbfd872fc))
* Introduce initial portal page, app header, date picker, and login form components. ([7757fc9](https://github.com/humexxx/allstars-galaxy/commit/7757fc90edccc40a5f85f33ce3e952ceefda7733))
* Introduce investment methods feature with new database schema, enum, display page, and seeding, plus AI context documentation. ([5ef8d48](https://github.com/humexxx/allstars-galaxy/commit/5ef8d48610ddf7e4989b7a2ee39b11b84c6b81ee))
* Introduce portal layout with authentication, user navigation, and date picker components. ([f418817](https://github.com/humexxx/allstars-galaxy/commit/f4188174c4ed4a3ef97785d95b74680c17bbf83f))
* **landing:** add robots.ts and sitemap.ts ([d116919](https://github.com/humexxx/allstars-galaxy/commit/d1169198452e8408642ea3fa3779eb15d3effbc6))
* **landing:** align landing with real portal modules and trim-success rhythm ([efe1163](https://github.com/humexxx/allstars-galaxy/commit/efe1163c8823c6ca98517343a97158439bbd40c0))
* **landing:** swap favicon for theme-aware shooting-star mark ([3e1e5e4](https://github.com/humexxx/allstars-galaxy/commit/3e1e5e499db5ca82a6ef0696b25adea07d11b631))
* **login:** wrap LoginForm in Suspense for improved loading experience ([406a36c](https://github.com/humexxx/allstars-galaxy/commit/406a36c40545e9027a122d6a930608f0576cb684))
* mostrar data inicial ([0195aa5](https://github.com/humexxx/allstars-galaxy/commit/0195aa5fb44a4bfcdbc188188743c81366f8f81a))
* optimizaciones de react ([b2ada11](https://github.com/humexxx/allstars-galaxy/commit/b2ada11b2a4eddd5db58014da45801cae4192505))
* **portal:** add loading, not-found and Suspense boundaries ([67ba9b4](https://github.com/humexxx/allstars-galaxy/commit/67ba9b4e7ab4fcf218382b695357bcbba1c69a49))
* **portal:** admin "More apps" page with Vercel auto-discovery ([af1fba6](https://github.com/humexxx/allstars-galaxy/commit/af1fba694acc93f162188a2ad9d6713866af5283))
* random ([ef7d9a5](https://github.com/humexxx/allstars-galaxy/commit/ef7d9a58584850da510edb86333f043c2a08ce44))
* remove daily change and percentage from portfolio header for cleaner UI ([41e4b6a](https://github.com/humexxx/allstars-galaxy/commit/41e4b6a25de9b88d56cb1df72cca0f4d23a6379e))
* remove unused components ([3a969aa](https://github.com/humexxx/allstars-galaxy/commit/3a969aa5794704f176e321242be4e298912c08bc))
* Set up Drizzle ORM with user schema and migration, and add initial portal page with user navigation and date picker components. ([cc8230b](https://github.com/humexxx/allstars-galaxy/commit/cc8230bc5bf2b4a4c2c19bf832814e2832690052))
* sidebar components. ([5f41a32](https://github.com/humexxx/allstars-galaxy/commit/5f41a32a1371f7188df071197604310ae4265169))
* **travel:** add PublicTripNotFound component for unavailable trip links ([406a36c](https://github.com/humexxx/allstars-galaxy/commit/406a36c40545e9027a122d6a930608f0576cb684))
* ui fixes ([6cd435f](https://github.com/humexxx/allstars-galaxy/commit/6cd435f1f16331cfe61ddb3a13276f37d109b8fe))
* **ui:** add fade-in transition between routes ([2561334](https://github.com/humexxx/allstars-galaxy/commit/25613342ff96d029e6f0197b91bfa0e332aabdca))
* update landing page components and restructure layout ([26e1001](https://github.com/humexxx/allstars-galaxy/commit/26e1001e7ddcd78ee6b7f71a472218544c6f4bac))


### Bug Fixes

* **finance:** "Today" KPI strips income/expense that hasn't hit yet ([cb1c884](https://github.com/humexxx/allstars-galaxy/commit/cb1c8842438e383b2f57b2bdaeda54f5e8e1b088))
* **finance:** day-precise window for recurring income/expense projections ([a17a890](https://github.com/humexxx/allstars-galaxy/commit/a17a8902f3132648aefa990f4b1c92776229ae4b))
* **finance:** delay calendar tooltips and highlight active chip ([9e9e3c0](https://github.com/humexxx/allstars-galaxy/commit/9e9e3c095bf47fd414a1487a6e67b40c378a4040))
* **finance:** flip calendar tooltips above/below the chip ([2faee2d](https://github.com/humexxx/allstars-galaxy/commit/2faee2d937f7f71eaaacb0bc13406d8bef30ac27))
* **finance:** ignore drag drops on the chip's own cell ([e510e0c](https://github.com/humexxx/allstars-galaxy/commit/e510e0cfdabb134b6b2cc99db4e1ff74c468d76d))
* **finance:** instant milestone tooltips via Radix instead of SVG &lt;title&gt; ([4b35f91](https://github.com/humexxx/allstars-galaxy/commit/4b35f91d0df1d70bf0ba270c34e2f1fa707089e2))
* **finance:** milestone tooltips via foreignObject so shadcn Tooltip fires ([693e4cd](https://github.com/humexxx/allstars-galaxy/commit/693e4cd9723f63cb31c5ce2ff08052766839329e))
* **finance:** partial-month Today snapshot + filter card breakdowns to current month ([f76d8da](https://github.com/humexxx/allstars-galaxy/commit/f76d8daa6413abdc3db94bdca8bb98caffa36473))
* **finance:** place milestone markers at the exact crossing point ([2cf2b84](https://github.com/humexxx/allstars-galaxy/commit/2cf2b8414bc3f5f87662651edc4d06960b82e4c0))
* **finance:** simplify amount label to "Amount" ([b7acb61](https://github.com/humexxx/allstars-galaxy/commit/b7acb61677fcd3f84b1eafd63d8ee826f8ea3798))
* **finance:** UTC month formatting + plan-coloured line + milestone markers ([726279a](https://github.com/humexxx/allstars-galaxy/commit/726279af429601603212a0272a287a717bab380b))
* **finance:** UTC-anchor remaining month formatters to fix Apr↔May shift ([53f1eee](https://github.com/humexxx/allstars-galaxy/commit/53f1eee037b04b9249109224e33cae68115a962d))
* **portal:** keep transaction dialog open on failure with pending state ([484f016](https://github.com/humexxx/allstars-galaxy/commit/484f01694d55a8608ca3bba3aea125554ee49fbd))
* **portal:** tighten accessibility on layout, animations and forms ([0b7a9c5](https://github.com/humexxx/allstars-galaxy/commit/0b7a9c53f197164a023556bc052c8ee4ad0c5773))
* **travel:** mark user-provided trip images as unoptimized ([21b5a09](https://github.com/humexxx/allstars-galaxy/commit/21b5a09158b5173a1c855e8aa0a8063cced28286))
* **ui:** gap between label and value in chart tooltip rows ([3b66021](https://github.com/humexxx/allstars-galaxy/commit/3b66021d253248bf78ea8b113f4928e948582e46))
* update default status to 'pending' in transaction filters and admin transactions page ([f53b43d](https://github.com/humexxx/allstars-galaxy/commit/f53b43db1c476fdd897704793dbe5917a833d703))


### Performance

* **finance:** dedupe plan fetches and lazy-load projection charts ([c7e1482](https://github.com/humexxx/allstars-galaxy/commit/c7e148266a5e51f77ba8f4cc7fea10efa17e7fe3))
* **finance:** optimistic updates for calendar drag + override menu ([06d064e](https://github.com/humexxx/allstars-galaxy/commit/06d064e7835ef5e76c9bf898bfa8accefa55d10a))
* **travel:** cache trip query and render covers through next/image ([fcca072](https://github.com/humexxx/allstars-galaxy/commit/fcca072ae5c61be84e703793d6642bb3eba12d98))


### Refactor

* **finance:** keep only the donut variant, drop card and old gauge ([2927eec](https://github.com/humexxx/allstars-galaxy/commit/2927eecf87daba0082f8f1263d17ab09cf088217))
* **finance:** switch chip drag back to native HTML5 with grip handle ([27c65b9](https://github.com/humexxx/allstars-galaxy/commit/27c65b9942adacd376d77acdfd3a2e1f5029c9d3))
* improve transaction status handling and update filters logic ([a74424c](https://github.com/humexxx/allstars-galaxy/commit/a74424c253f8d2eafa64be024212ae745bc03b6d))
* **portal:** consolidate action error handling and admin service layer ([42b8a91](https://github.com/humexxx/allstars-galaxy/commit/42b8a91fab9e9dc0123a53ea689fd61edf75503e))
* **portal:** replace /api/transactions with a server action ([7e7bd42](https://github.com/humexxx/allstars-galaxy/commit/7e7bd4232d36d06f0d9c38c94c397ecc6c1ab54d))
* update middleware ([a4ff6dc](https://github.com/humexxx/allstars-galaxy/commit/a4ff6dc4b6756a40516406a8a950555069eba461))
