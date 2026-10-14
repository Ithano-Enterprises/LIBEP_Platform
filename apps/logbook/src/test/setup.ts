import { configure } from '@testing-library/react-native';

// Screen tests run real SQLite work between steps. With all suites running
// in parallel, the default 1 s wait for async UI is too tight.
configure({ asyncUtilTimeout: 5000 });
