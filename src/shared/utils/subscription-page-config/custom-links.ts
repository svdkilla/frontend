import { SubscriptionPageRawConfigSchema } from '@remnawave/subscription-page-types'
import { z } from 'zod'

export const CUSTOM_LINK_ACTIONS = ['open', 'copy', 'qr'] as const
export const CUSTOM_LINK_MODES = ['literal', 'template', 'subscriptionLinks'] as const
export const ALLOWED_CUSTOM_LINK_SCHEMES = [
    'https',
    'http',
    'vless',
    'vmess',
    'trojan',
    'ss',
    'hysteria2',
    'hy2',
    'tuic',
    'wireguard',
    'sub'
] as const
export const CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS = [
    'vless',
    'vmess',
    'trojan',
    'ss',
    'hysteria2',
    'hy2',
    'tuic',
    'wireguard',
    'sub'
] as const
export const CUSTOM_LINK_TEMPLATE_VARIABLES = ['username', 'shortUuid', 'subscriptionUrl'] as const

const MAX_URI_LENGTH = 4096
const HTML_DELIMITERS = /[<>]/u

const hasControlCharacters = (value: string): boolean =>
    Array.from(value).some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
    })
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/u
const PERCENT_ESCAPE_PATTERN = /%[0-9A-Fa-f]{2}/u
const TEMPLATE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/gu
const allowedSchemes = new Set<string>(ALLOWED_CUSTOM_LINK_SCHEMES)
const allowedVariables = new Set<string>(CUSTOM_LINK_TEMPLATE_VARIABLES)

const decodedVariants = (value: string): string[] | null => {
    if (!value.includes('%')) return [value]
    try {
        const once = decodeURIComponent(value)
        if (PERCENT_ESCAPE_PATTERN.test(once) && decodeURIComponent(once) !== once) return null
        return [value, once]
    } catch {
        return null
    }
}

export const getCustomLinkUriError = (value: string): string | null => {
    if (!value) return 'URI is required'
    if (value.length > MAX_URI_LENGTH) return `URI must not exceed ${MAX_URI_LENGTH} characters`
    if (value !== value.trim()) return 'URI must not have leading or trailing whitespace'

    const variants = decodedVariants(value)
    if (!variants) return 'URI contains malformed or ambiguous percent-encoding'
    if (variants.some((item) => hasControlCharacters(item) || HTML_DELIMITERS.test(item))) {
        return 'URI contains unsafe characters or markup'
    }

    const match = SCHEME_PATTERN.exec(value)
    if (!match) return 'URI must start with an explicit allowed scheme'
    const scheme = match[1]!.toLowerCase()
    if (!allowedSchemes.has(scheme)) return `URI scheme '${scheme}' is not allowed`

    if (scheme === 'https' || scheme === 'http') {
        try {
            const parsed = new URL(value)
            if (parsed.protocol !== `${scheme}:` || !parsed.hostname) {
                return 'HTTP(S) URI must contain a valid host'
            }
        } catch {
            return 'HTTP(S) URI is invalid'
        }
    } else {
        const payload = value.slice(match[0].length)
        if (!payload || /\s/u.test(payload)) {
            return 'VPN URI must contain a non-empty payload without whitespace'
        }
    }

    return null
}

export const getCustomLinkTemplateError = (template: string): string | null => {
    for (const match of template.matchAll(TEMPLATE_PATTERN)) {
        if (!allowedVariables.has(match[1]!)) {
            return `Template variable '{{${match[1]}}}' is not allowed`
        }
    }

    const remainder = template.replace(TEMPLATE_PATTERN, 'value')
    if (remainder.includes('{{') || remainder.includes('}}')) {
        return 'Template contains malformed variable syntax'
    }

    return getCustomLinkUriError(
        template
            .replace(/\{\{username\}\}/gu, 'example-user')
            .replace(/\{\{shortUuid\}\}/gu, '01234567')
            .replace(/\{\{subscriptionUrl\}\}/gu, 'https://subscription.invalid/example')
    )
}

const DisplayNameSchema = z
    .record(
        z.string().regex(/^[a-z]{2}$/u),
        z
            .string()
            .trim()
            .min(1, 'Display name is required')
            .max(100, 'Display name must be 100 characters or fewer')
            .refine((value) => !HTML_DELIMITERS.test(value), 'Display name must not contain HTML')
    )
    .refine((value) => Object.keys(value).length > 0, 'At least one language is required')

export const CustomLinkSchema = z
    .object({
        id: z
            .string()
            .min(1)
            .max(64)
            .regex(/^[A-Za-z0-9_-]+$/u),
        enabled: z.boolean().default(true),
        displayName: DisplayNameSchema,
        uri: z.string().default(''),
        action: z.enum(CUSTOM_LINK_ACTIONS),
        iconKey: z.string().optional(),
        order: z.number().int().min(0).max(10_000),
        mode: z.enum(CUSTOM_LINK_MODES).default('literal'),
        protocol: z.enum(CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS).optional()
    })
    .superRefine((value, context) => {
        if (value.mode === 'subscriptionLinks') {
            if (!value.protocol) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Protocol is required',
                    path: ['protocol']
                })
            }
            return
        }

        const error =
            value.mode === 'template'
                ? getCustomLinkTemplateError(value.uri)
                : getCustomLinkUriError(value.uri)
        if (error) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: ['uri']
            })
        }
    })

export const CustomLinksSchema = z.array(CustomLinkSchema).max(50)

export const PanelSubscriptionPageConfigSchema = z.unknown().transform((input, context) => {
    const baseResult = SubscriptionPageRawConfigSchema.safeParse(input)
    const customLinksResult = CustomLinksSchema.safeParse(
        input && typeof input === 'object' && 'customLinks' in input
            ? ((input as { customLinks?: unknown }).customLinks ?? [])
            : []
    )

    if (!baseResult.success) {
        baseResult.error.issues.forEach((issue) => context.addIssue(issue))
    }
    if (!customLinksResult.success) {
        customLinksResult.error.issues.forEach((issue) =>
            context.addIssue({ ...issue, path: ['customLinks', ...issue.path] })
        )
    }
    if (!baseResult.success || !customLinksResult.success) return z.NEVER

    const ids = new Set<string>()
    customLinksResult.data.forEach((link, index) => {
        if (ids.has(link.id)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate custom link ID '${link.id}'`,
                path: ['customLinks', index, 'id']
            })
        }
        ids.add(link.id)
    })

    return { ...baseResult.data, customLinks: customLinksResult.data }
})

export type TSubscriptionPageCustomLink = z.infer<typeof CustomLinkSchema>
export type TPanelSubscriptionPageConfig = z.infer<typeof PanelSubscriptionPageConfigSchema>
