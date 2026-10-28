import { configure } from '@testing-library/react-native';

import { PHONE, setWindow } from './window';

// Screen tests render and run real SQLite work between steps. With suites
// running in parallel the CPU is shared, so the default 1 s wait for async
// UI is too tight. package.json also raises the per-test limit to 20 s and
// uses half the cores.
configure({ asyncUtilTimeout: 10000 });

// Jest's default window is 750 wide, above the tablet breakpoint. Screens
// are tested as a phone unless a test sets the tablet size.
beforeEach(() => setWindow(PHONE));
