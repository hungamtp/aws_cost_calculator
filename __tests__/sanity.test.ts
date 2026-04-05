import { expect, test, describe } from 'vitest';

describe('Phase 0 Sanity Tests', () => {
    test('Basic math ensures test runner is operational', () => {
        expect(1 + 1).toBe(2);
    });

    test('String manipulation sanity', () => {
        expect('EC2'.toLowerCase()).toBe('ec2');
    });
});
