import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Card,
    Divider,
    Drawer,
    Group,
    Select,
    SimpleGrid,
    Stack,
    Switch,
    Text,
    TextInput,
    Tooltip
} from '@mantine/core'
import { UseFormReturnType } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { nanoid } from 'nanoid'
import { CSSProperties, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    TbArrowsMoveVertical,
    TbExternalLink,
    TbInfoCircle,
    TbLink,
    TbPencil,
    TbPlus,
    TbQrcode,
    TbTrash
} from 'react-icons/tb'

import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import {
    CUSTOM_LINK_ACTIONS,
    CUSTOM_LINK_MODES,
    CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS,
    CustomLinkSchema,
    TPanelSubscriptionPageConfig,
    TSubscriptionPageCustomLink
} from '@shared/utils/subscription-page-config'

import { SvgIconSelect } from '../editor-components/svg-icon-select.component'
import styles from '../subpage-config-visual-editor.module.css'

interface Props {
    form: UseFormReturnType<TPanelSubscriptionPageConfig>
}

interface RowProps {
    currentLocale: string
    link: TSubscriptionPageCustomLink
    onDelete: () => void
    onEdit: () => void
    onToggle: (enabled: boolean) => void
}

function SortableCustomLinkRow({ currentLocale, link, onDelete, onEdit, onToggle }: RowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: link.id
    })
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : 'auto'
    }

    const name = link.displayName[currentLocale] ?? Object.values(link.displayName)[0] ?? link.id
    const detail =
        link.mode === 'subscriptionLinks' ? `${link.protocol ?? '—'}://` : link.uri || '—'
    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/u.exec(link.uri)?.[1]?.toLowerCase()
    const destination =
        link.mode === 'subscriptionLinks'
            ? 'Page shortcut'
            : scheme === 'http' || scheme === 'https'
              ? 'Header'
              : 'Server list'

    return (
        <Card className={styles.buttonCard} p="sm" radius="md" ref={setNodeRef} style={style}>
            <Group gap="sm" justify="space-between" wrap="nowrap">
                <ActionIcon
                    aria-label="Reorder link"
                    color="gray"
                    size="lg"
                    style={{ cursor: 'grab' }}
                    variant="subtle"
                    {...attributes}
                    {...listeners}
                >
                    <TbArrowsMoveVertical size={18} />
                </ActionIcon>

                <Box miw={0} style={{ flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                        <Text fw={600} size="sm">
                            {name}
                        </Text>
                        <Badge color={link.enabled ? 'teal' : 'gray'} size="xs" variant="light">
                            {link.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge color="cyan" size="xs" variant="outline">
                            {link.action}
                        </Badge>
                        <Badge color="violet" size="xs" variant="outline">
                            {link.mode}
                        </Badge>
                        <Badge color="blue" size="xs" variant="light">
                            {destination}
                        </Badge>
                    </Group>
                    <Text c="dimmed" ff="monospace" size="xs" truncate>
                        {detail}
                    </Text>
                </Box>

                <Group gap={4} wrap="nowrap">
                    <Switch
                        aria-label="Enable custom link"
                        checked={link.enabled}
                        onChange={(event) => onToggle(event.currentTarget.checked)}
                        size="sm"
                    />
                    <Tooltip label="Edit">
                        <ActionIcon color="cyan" onClick={onEdit} variant="subtle">
                            <TbPencil size={17} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                        <ActionIcon color="red" onClick={onDelete} variant="subtle">
                            <TbTrash size={17} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>
        </Card>
    )
}

const createDraft = (
    locales: TPanelSubscriptionPageConfig['locales'],
    order: number
): TSubscriptionPageCustomLink => ({
    id: nanoid(12),
    enabled: true,
    displayName: Object.fromEntries(locales.map((locale) => [locale, ''])) as Record<
        (typeof locales)[number],
        string
    >,
    uri: 'https://',
    action: 'open',
    order,
    mode: 'literal'
})

export function CustomLinksBlockComponent({ form }: Props) {
    const { t } = useTranslation()
    const values = form.getValues()
    const links = values.customLinks ?? []
    const [opened, setOpened] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState<TSubscriptionPageCustomLink>(() =>
        createDraft(values.locales, links.length)
    )
    const [errors, setErrors] = useState<Record<string, string>>({})
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
    const currentLocale = values.locales[0] ?? 'en'

    const actionData = useMemo(
        () =>
            CUSTOM_LINK_ACTIONS.map((value) => ({
                value,
                label: t(`custom-links-block.component.action-${value}`)
            })),
        [t]
    )
    const modeData = useMemo(
        () =>
            CUSTOM_LINK_MODES.map((value) => ({
                value,
                label: t(`custom-links-block.component.mode-${value}`)
            })),
        [t]
    )

    const openNew = () => {
        setEditingId(null)
        setDraft(createDraft(form.getValues().locales, form.getValues().customLinks.length))
        setErrors({})
        setOpened(true)
    }

    const openEdit = (link: TSubscriptionPageCustomLink) => {
        setEditingId(link.id)
        setDraft({ ...link, displayName: { ...link.displayName } })
        setErrors({})
        setOpened(true)
    }

    const saveDraft = () => {
        const result = CustomLinkSchema.safeParse(draft)
        if (!result.success) {
            setErrors(
                Object.fromEntries(
                    result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
                )
            )
            notifications.show({
                color: 'red',
                title: t('custom-links-block.component.validation-error'),
                message: t('custom-links-block.component.fix-fields')
            })
            return
        }

        const next = editingId
            ? links.map((link) => (link.id === editingId ? result.data : link))
            : [...links, result.data]
        form.setFieldValue(
            'customLinks',
            next.map((link, order) => ({ ...link, order }))
        )
        setOpened(false)
    }

    const deleteLink = (link: TSubscriptionPageCustomLink) => {
        const label =
            link.displayName[currentLocale] ?? Object.values(link.displayName)[0] ?? link.id
        modals.openConfirmModal({
            centered: true,
            title: t('custom-links-block.component.delete-title'),
            children: (
                <Text size="sm">
                    {t('custom-links-block.component.delete-confirm', { name: label })}
                </Text>
            ),
            labels: { confirm: t('common.delete'), cancel: t('common.cancel') },
            confirmProps: { color: 'red' },
            onConfirm: () => {
                form.setFieldValue(
                    'customLinks',
                    links
                        .filter((item) => item.id !== link.id)
                        .map((item, order) => ({ ...item, order }))
                )
            }
        })
    }

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return
        const from = links.findIndex((link) => link.id === active.id)
        const to = links.findIndex((link) => link.id === over.id)
        if (from < 0 || to < 0) return
        form.setFieldValue(
            'customLinks',
            arrayMove(links, from, to).map((link, order) => ({ ...link, order }))
        )
    }

    const previewLabel =
        draft.displayName[currentLocale] ?? Object.values(draft.displayName)[0] ?? 'Preview'

    return (
        <>
            <Card className={styles.sectionCard} p="lg" radius="lg">
                <Stack gap="md">
                    <Group justify="space-between">
                        <BaseOverlayHeader
                            iconColor="cyan"
                            IconComponent={TbLink}
                            iconSize={20}
                            iconVariant="soft"
                            subtitle={t('custom-links-block.component.subtitle')}
                            title={t('custom-links-block.component.title')}
                            titleOrder={5}
                        />
                        <Button
                            leftSection={<TbPlus size={18} />}
                            onClick={openNew}
                            variant="light"
                        >
                            {t('custom-links-block.component.add')}
                        </Button>
                    </Group>
                    <Divider className={styles.divider} />

                    {links.length === 0 ? (
                        <Box className={styles.emptyState}>
                            <TbLink size={32} />
                            <Text mt="sm" size="sm">
                                {t('custom-links-block.component.empty')}
                            </Text>
                            <Text c="dimmed" size="xs">
                                {t('custom-links-block.component.empty-hint')}
                            </Text>
                        </Box>
                    ) : (
                        <DndContext
                            collisionDetection={closestCenter}
                            modifiers={[restrictToVerticalAxis]}
                            onDragEnd={onDragEnd}
                            sensors={sensors}
                        >
                            <SortableContext
                                items={links.map((link) => link.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <Stack gap="xs">
                                    {links.map((link) => (
                                        <SortableCustomLinkRow
                                            currentLocale={currentLocale}
                                            key={link.id}
                                            link={link}
                                            onDelete={() => deleteLink(link)}
                                            onEdit={() => openEdit(link)}
                                            onToggle={(enabled) =>
                                                form.setFieldValue(
                                                    'customLinks',
                                                    links.map((item) =>
                                                        item.id === link.id
                                                            ? { ...item, enabled }
                                                            : item
                                                    )
                                                )
                                            }
                                        />
                                    ))}
                                </Stack>
                            </SortableContext>
                        </DndContext>
                    )}
                </Stack>
            </Card>

            <Drawer
                onClose={() => setOpened(false)}
                opened={opened}
                position="right"
                size="lg"
                title={
                    <BaseOverlayHeader
                        iconColor="cyan"
                        IconComponent={editingId ? TbPencil : TbPlus}
                        iconVariant="soft"
                        title={
                            editingId
                                ? t('custom-links-block.component.edit')
                                : t('custom-links-block.component.add')
                        }
                    />
                }
            >
                <Stack gap="md">
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        <Select
                            allowDeselect={false}
                            data={modeData}
                            error={errors.mode}
                            label={t('custom-links-block.component.mode')}
                            onChange={(value) =>
                                value &&
                                setDraft({
                                    ...draft,
                                    mode: value as TSubscriptionPageCustomLink['mode'],
                                    protocol:
                                        value === 'subscriptionLinks'
                                            ? (draft.protocol ?? 'vless')
                                            : undefined
                                })
                            }
                            value={draft.mode}
                        />
                        <Select
                            allowDeselect={false}
                            data={actionData}
                            error={errors.action}
                            label={t('custom-links-block.component.action')}
                            onChange={(value) =>
                                value &&
                                setDraft({
                                    ...draft,
                                    action: value as TSubscriptionPageCustomLink['action']
                                })
                            }
                            value={draft.action}
                        />
                    </SimpleGrid>

                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        {values.locales.map((locale) => (
                            <TextInput
                                error={errors[`displayName.${locale}`]}
                                key={locale}
                                label={`${t('custom-links-block.component.display-name')} (${locale.toUpperCase()})`}
                                maxLength={100}
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        displayName: {
                                            ...draft.displayName,
                                            [locale]: event.currentTarget.value
                                        }
                                    })
                                }
                                required
                                value={draft.displayName[locale] ?? ''}
                            />
                        ))}
                    </SimpleGrid>

                    {draft.mode === 'subscriptionLinks' ? (
                        <Select
                            allowDeselect={false}
                            data={CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS.map((protocol) => ({
                                value: protocol,
                                label: `${protocol}://`
                            }))}
                            error={errors.protocol}
                            label={t('custom-links-block.component.protocol')}
                            onChange={(value) =>
                                value &&
                                setDraft({
                                    ...draft,
                                    protocol: value as TSubscriptionPageCustomLink['protocol']
                                })
                            }
                            searchable
                            value={draft.protocol ?? 'vless'}
                        />
                    ) : (
                        <TextInput
                            description={
                                draft.mode === 'template'
                                    ? t('custom-links-block.component.template-variables', {
                                          username: '{{username}}',
                                          shortUuid: '{{shortUuid}}',
                                          subscriptionUrl: '{{subscriptionUrl}}'
                                      })
                                    : undefined
                            }
                            error={errors.uri}
                            label="URI"
                            maxLength={4096}
                            onChange={(event) =>
                                setDraft({ ...draft, uri: event.currentTarget.value })
                            }
                            required
                            value={draft.uri}
                        />
                    )}

                    {draft.mode === 'literal' && (
                        <Alert color="yellow" icon={<TbInfoCircle size={18} />} variant="light">
                            {t('custom-links-block.component.literal-warning')}
                        </Alert>
                    )}

                    <SvgIconSelect
                        label={t('custom-links-block.component.icon')}
                        onChange={(iconKey) => setDraft({ ...draft, iconKey })}
                        required={false}
                        svgLibrary={values.svgLibrary}
                        value={draft.iconKey}
                    />

                    <Card className={styles.buttonCard} p="md" radius="md">
                        <Stack gap="xs">
                            <Text c="dimmed" size="xs">
                                {t('custom-links-block.component.preview')}
                            </Text>
                            <Group justify="space-between" wrap="nowrap">
                                <Box miw={0}>
                                    <Text fw={600} size="sm" truncate>
                                        {previewLabel || t('custom-links-block.component.unnamed')}
                                    </Text>
                                    <Text c="dimmed" ff="monospace" size="xs" truncate>
                                        {draft.mode === 'subscriptionLinks'
                                            ? `${draft.protocol ?? 'vless'}://…`
                                            : draft.uri || '—'}
                                    </Text>
                                </Box>
                                <ActionIcon color="cyan" variant="light">
                                    {draft.action === 'qr' ? (
                                        <TbQrcode size={18} />
                                    ) : (
                                        <TbExternalLink size={18} />
                                    )}
                                </ActionIcon>
                            </Group>
                        </Stack>
                    </Card>

                    <Group justify="flex-end">
                        <Button onClick={() => setOpened(false)} variant="default">
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={saveDraft}>{t('common.save')}</Button>
                    </Group>
                </Stack>
            </Drawer>
        </>
    )
}
