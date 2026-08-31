import { useMutation, useQuery } from '@tanstack/react-query'

import { instance, queryClient } from '@shared/api'

export interface ExtendedServerListPreference {
    enabled: boolean
    userUuid: string
}

interface PreferenceResponse {
    response: ExtendedServerListPreference
}

export const extendedServerListQueryKey = (userUuid: string) => [
    'users',
    userUuid,
    'extended-server-list'
]

export const useExtendedServerListPreference = (userUuid: string) =>
    useQuery({
        enabled: Boolean(userUuid),
        queryKey: extendedServerListQueryKey(userUuid),
        queryFn: async () => {
            const { data } = await instance.get<PreferenceResponse>(
                `/api/xconnect/users/${userUuid}/extended-server-list`
            )
            return data.response
        }
    })

export const useUpdateExtendedServerListPreference = (userUuid: string) =>
    useMutation({
        mutationFn: async (enabled: boolean) => {
            const { data } = await instance.patch<PreferenceResponse>(
                `/api/xconnect/users/${userUuid}/extended-server-list`,
                { enabled }
            )
            return data.response
        },
        onSuccess: (preference) => {
            queryClient.setQueryData(extendedServerListQueryKey(userUuid), preference)
        }
    })
