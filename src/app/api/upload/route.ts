import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { v4 as uuid } from 'uuid'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('type') as string || 'file'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${user.id}/${fileType}/${uuid()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from('captures')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('[upload] Storage error:', error)
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('captures')
      .getPublicUrl(filePath)

    return NextResponse.json({
      path: filePath,
      url: urlData.publicUrl,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[upload] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
