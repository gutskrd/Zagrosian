/**
 * Client entry point, loaded on every page by BaseLayout.astro. The same bundle runs everywhere:
 * each feature looks for its own elements and does nothing on pages without them.
 */

// First: installs the Popover API fallback for older browsers before anything uses a popover.
import './utils/popover';

import { initCommandMenu } from './command-menu';
import { initDeer } from './hevalo/deer';
import { initEyes } from './hevalo/eyes';
import { initLanguageMenu, initLanguageSuggestion } from './language';
import { initLegalTools, initTableOfContents } from './legal';
import { initLocalTime } from './local-time';
import { initMotion } from './motion';
import { initReveal } from './motion/reveal';
import { initText } from './motion/text';
import { initDeepLink, initHeader, initMenu, initSectionNav } from './navigation';
import { initRegistration } from './registration';
import { initRug } from './rug';
import { initCopyButtons, initShare } from './share';
import { initSound } from './sound';
import { initTheme } from './theme';

// First, so the footer's registration details are requested as early as possible.
initRegistration();
initHeader();
initDeepLink();
initMenu();
initReveal();
initTableOfContents();
initSectionNav();
initCopyButtons();
initShare();
initLocalTime();
initLegalTools();
initCommandMenu();
initTheme();
initLanguageMenu();
initLanguageSuggestion();
initMotion();
initText();
initSound();
initEyes();
initDeer();
initRug();
