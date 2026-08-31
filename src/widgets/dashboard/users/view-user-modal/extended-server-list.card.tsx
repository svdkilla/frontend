import { Alert, Group, Switch, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ForwardRefComponent, HTMLMotionProps, Variants } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { TbServerBolt } from 'react-icons/tb'

import {
    useExtendedServerListPreference,
    useUpdateExtendedServerListPreference
} from '@shared/api/hooks'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SectionCard } from '@shared/ui/section-card'

interface IProps {
    cardVariants: Variants
    motionWrapper: ForwardRefComponent<HTMLDivElement, HTMLMotionProps<'div'>>
    userUuid: string
}

export const ExtendedServerListCard = (props: IProps) => {
    const { cardVariants, motionWrapper: MotionWrapper, userUuid } = props
    const { t } = useTranslation()
    const preference = useExtendedServerListPreference(userUuid)
    const updatePreference = useUpdateExtendedServerListPreference(userUuid)

    const handleChange = (enabled: boolean) => {
        updatePreference.mutate(enabled, {
            onSuccess: () => {
                notifications.show({
                    color: 'teal',
                    title: t('extended-server-list-card.saved'),
                    message: enabled
                        ? t('extended-server-list-card.enabled-message')
                        : t('extended-server-list-card.disabled-message')
                })
            },
            onError: () => {
                notifications.show({
                    color: 'red',
                    title: t('extended-server-list-card.error-title'),
                    message: t('extended-server-list-card.error-message')
                })
            }
        })
    }

    return (
        <MotionWrapper variants={cardVariants}>
            <SectionCard.Root>
                <SectionCard.Section>
                    <BaseOverlayHeader
                        iconColor="blue"
                        IconComponent={TbServerBolt}
                        iconSize={20}
                        iconVariant="soft"
                        title={t('extended-server-list-card.title')}
                        titleOrder={5}
                    />
                </SectionCard.Section>

                <SectionCard.Section>
                    {preference.isError ? (
                        <Alert color="red" variant="light">
                            {t('extended-server-list-card.error-message')}
                        </Alert>
                    ) : (
                        <Group align="flex-start" justify="space-between" wrap="nowrap">
                            <div>
                                <Text fw={500} size="sm">
                                    {t('extended-server-list-card.switch-label')}
                                </Text>
                                <Text c="dimmed" mt={4} size="xs">
                                    {t('extended-server-list-card.description')}
                                </Text>
                            </div>
                            <Switch
                                aria-label={t('extended-server-list-card.switch-label')}
                                checked={preference.data?.enabled ?? false}
                                disabled={preference.isLoading || updatePreference.isPending}
                                onChange={(event) => handleChange(event.currentTarget.checked)}
                                size="md"
                            />
                        </Group>
                    )}
                </SectionCard.Section>
            </SectionCard.Root>
        </MotionWrapper>
    )
}
