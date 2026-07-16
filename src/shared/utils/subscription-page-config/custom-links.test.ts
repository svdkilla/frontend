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

    it('rejects unknown template variables', () => {
        expect(
            CustomLinkSchema.safeParse({
                ...link,
                mode: 'template',
                uri: 'https://example.com/{{process.env.SECRET}}'
            }).success
        ).toBe(false)
    })
})
