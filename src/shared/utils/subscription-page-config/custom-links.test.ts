import { describe, expect, it } from 'vitest'

import { CustomLinkSchema, getCustomLinkUriError } from './custom-links'

const link = {
    id: 'example-link',
    enabled: true,
    displayName: { en: 'Example' },
    action: 'copy' as const,
    order: 0
}

describe('panel custom-link validation', () => {
    it.each([
        'vless://id@example.com:443?security=tls',
        'hysteria2://secret@example.com:443',
        'hy2://secret@example.com:443',
        'wg://opaque-payload#WG',
        'awg://opaque-payload#AWG',
        'myvpn+test://anything-the-client-understands#Custom',
        'https://example.com/path'
    ])('accepts %s', (uri) => {
        expect(getCustomLinkUriError(uri)).toBeNull()
    })

    it.each([
        'javascript:alert(1)',
        'data:text/html,<svg onload=alert(1)>',
        'file:///etc/passwd',
        ' https://example.com',
        'https%253A%252F%252Fevil.example',
        'https://example.com/%3Cscript%3E'
    ])('rejects %s', (uri) => {
        expect(getCustomLinkUriError(uri)).not.toBeNull()
    })

    it('defaults old links without a mode to literal', () => {
        const parsed = CustomLinkSchema.parse({
            ...link,
            uri: 'https://example.com'
        })
        expect(parsed.mode).toBe('literal')
    })

    it('rejects the removed personalized-template mode', () => {
        expect(
            CustomLinkSchema.safeParse({
                ...link,
                mode: 'template',
                uri: 'https://example.com/{{username}}'
            }).success
        ).toBe(false)
    })

    it('does not require presentation fields for a connection link', () => {
        const parsed = CustomLinkSchema.parse({
            id: 'connection-only',
            enabled: true,
            uri: 'awg://opaque-payload#Name-from-fragment',
            order: 0,
            mode: 'subscriptionLinks'
        })

        expect(parsed.displayName).toEqual({})
        expect(parsed.action).toBe('copy')
    })

    it('keeps header and connection destinations explicit', () => {
        expect(
            CustomLinkSchema.safeParse({
                ...link,
                mode: 'literal',
                uri: 'vless://opaque-payload#Wrong'
            }).success
        ).toBe(false)
        expect(
            CustomLinkSchema.safeParse({
                ...link,
                mode: 'subscriptionLinks',
                uri: 'https://example.com/wrong'
            }).success
        ).toBe(false)
    })
})
