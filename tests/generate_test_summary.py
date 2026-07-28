#!/usr/bin/env python3
"""
Generate comprehensive test summary report for the temple website E2E tests.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

def load_test_results() -> Dict[str, Any]:
    """Load test results from Playwright JSON output."""
    results_file = Path('reports/playwright-test-results.json')
    
    if not results_file.exists():
        return {
            'stats': {'total': 0, 'passed': 0, 'failed': 0, 'skipped': 0},
            'suites': [],
            'errors': []
        }
    
    with open(results_file, 'r') as f:
        return json.load(f)

def count_tests_by_module(results: Dict[str, Any]) -> Dict[str, int]:
    """Count tests by module."""
    module_counts = {}
    
    for suite in results.get('suites', []):
        for test in suite.get('tests', []):
            test_name = test.get('title', '')
            # Extract module from test name (e.g., "HP-001" -> "Homepage")
            if '-' in test_name:
                prefix = test_name.split('-')[0]
                module = {
                    'HP': 'Homepage',
                    'AUTH': 'Authentication',
                    'NAV': 'Navigation',
                    'EVT': 'Events',
                    'GAL': 'Gallery',
                    'DON': 'Donations',
                    'SEV': 'Sevas',
                    'BOT': 'Chatbot',
                    'ADM': 'Admin',
                    'API': 'API',
                    'FORM': 'Forms',
                    'A11Y': 'Accessibility',
                    'RESP': 'Responsive',
                    'SEO': 'SEO',
                    'SEC': 'Security',
                    'PERF': 'Performance',
                    'ERR': 'Error Handling',
                    'STORAGE': 'Storage',
                    'FIR': 'Firestore',
                    'ABOUT': 'About',
                    'AAR': 'Aaradhane',
                    'CAL': 'Calendar',
                    'QUOTE': 'Quotes',
                    'SHLOKA': 'Shlokas',
                    'STOTRA': 'Stotras',
                    'TEST': 'Testimonials',
                    'VOL': 'Volunteer',
                    'TRUST': 'Trust',
                    'GURU': 'Guru',
                    'TIMELINE': 'Timeline',
                    'JOURNEY': 'Journey',
                    'FACILITIES': 'Facilities',
                    'FUTURE': 'Future Plans',
                }.get(prefix, 'Other')
                
                module_counts[module] = module_counts.get(module, 0) + 1
    
    return module_counts

def generate_report(results: Dict[str, Any]) -> str:
    """Generate the test summary report."""
    
    stats = results.get('stats', {})
    total = stats.get('total', 0)
    passed = stats.get('passed', 0)
    failed = stats.get('failed', 0)
    skipped = stats.get('skipped', 0)
    
    pass_percentage = (passed / total * 100) if total > 0 else 0
    
    module_counts = count_tests_by_module(results)
    
    report = f"""
# Temple Website E2E Test Summary

## Executive Summary

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Project:** Sri Raghavendra Swamy Temple Website
**Test Framework:** Playwright

## Overall Results

| Metric | Value |
|--------|-------|
| Total Tests | {total} |
| Passed | {passed} |
| Failed | {failed} |
| Skipped | {skipped} |
| Pass Rate | {pass_percentage:.1f}% |

## Test Coverage by Module

| Module | Test Count |
|--------|------------|
"""
    
    for module, count in sorted(module_counts.items(), key=lambda x: x[1], reverse=True):
        report += f"| {module} | {count} |\n"
    
    report += f"""
## Test Categories

### Functional Tests
- Homepage, About, Events, Gallery, Sevas, Donations
- Authentication, Admin Portal, Chatbot

### Non-Functional Tests
- Accessibility (ARIA, keyboard navigation, screen readers)
- Responsive Design (Desktop, Tablet, Mobile)
- Performance (Page load, Core Web Vitals)
- Security (XSS, CSRF, SQL injection)
- SEO (Meta tags, Open Graph, structured data)

### Integration Tests
- Firebase Firestore operations
- Firebase Storage uploads/downloads
- API endpoints
- Form validation

## Quality Metrics

### Accessibility Score
Tests verify:
- ARIA labels and roles
- Keyboard navigation
- Focus indicators
- Screen reader compatibility
- Color contrast
- Heading hierarchy

### Performance Targets
- Page load: < 3 seconds
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

### Security Validations
- XSS prevention
- SQL injection prevention
- Authentication bypass prevention
- Input validation
- Sensitive data exposure

## Browser Coverage

Tests run on:
- Chrome (Desktop)
- Firefox (Desktop)
- Safari/WebKit (Desktop)
- Chrome (Mobile)
- Safari (Mobile)

## Next Steps

1. Review and fix failed tests
2. Increase test coverage for edge cases
3. Add more API endpoint tests
4. Implement visual regression tests
5. Add performance benchmarking

---
*Report generated by Temple Website Test Suite*
"""
    
    return report

def main():
    """Main function to generate the report."""
    print("Generating test summary report...")
    
    # Ensure reports directory exists
    os.makedirs('reports', exist_ok=True)
    
    # Load results
    results = load_test_results()
    
    # Generate report
    report = generate_report(results)
    
    # Save report
    report_path = Path('reports/TESTING_SUMMARY.md')
    with open(report_path, 'w') as f:
        f.write(report)
    
    print(f"Report saved to: {report_path}")
    
    # Also create a JSON summary
    stats = results.get('stats', {})
    summary = {
        'generated_at': datetime.now().isoformat(),
        'total_tests': stats.get('total', 0),
        'passed': stats.get('passed', 0),
        'failed': stats.get('failed', 0),
        'skipped': stats.get('skipped', 0),
        'pass_percentage': (stats.get('passed', 0) / stats.get('total', 1) * 100) if stats.get('total', 0) > 0 else 0,
        'modules': count_tests_by_module(results)
    }
    
    summary_path = Path('reports/test_summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"JSON summary saved to: {summary_path}")
    print("\nTest Summary:")
    print(f"  Total: {summary['total_tests']}")
    print(f"  Passed: {summary['passed']}")
    print(f"  Failed: {summary['failed']}")
    print(f"  Pass Rate: {summary['pass_percentage']:.1f}%")

if __name__ == '__main__':
    main()
