// ./widgets/index.ts
// This file exists purely so every widget module gets imported and executed
// at least once. `createWidget(...)` only registers a widget kind when its
// module actually runs — if nothing imports a widget file, Metro can tree-shake
// it out of the JS bundle shipped to the widget extension, and iOS will show
// "No layout found for <kind>" when it tries to render that widget.
//
// Import this file from your app's root entry (app/_layout.tsx) to guarantee
// every widget gets bundled.

import './TodayVlogger';
import './YourTurn';
import './YesterdayRecap';
import './LatestClip';
import './DailyStoryProgress';