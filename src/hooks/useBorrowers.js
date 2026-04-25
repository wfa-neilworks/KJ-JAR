import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useBorrowers() {
  return useQuery({
    queryKey: ['borrowers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrowers')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useAddBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (borrower) => {
      const { data, error } = await supabase.from('borrowers').insert(borrower).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}

export function useSetBorrowerActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('borrowers').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}

export function useEditBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, mobile, address, facebook, guarantor }) => {
      const { error } = await supabase
        .from('borrowers')
        .update({ name, mobile, address, facebook, guarantor })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}
