import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync } from 'fs'
import { getConfig } from '../index.js'

const tmpFile = './.tmp-config.yaml'

describe('getConfig', () => {
    it('returns parsed object when file exists', () => {
        writeFileSync(tmpFile, 'title: Hello\nitems:\n  - one\n  - two')
        const config = getConfig(tmpFile)

        expect(config.title).toBe('Hello')
        expect(config.items).toEqual(['one', 'two'])

        unlinkSync(tmpFile)
    })

    it('returns empty object when file does not exist', () => {
        const config = getConfig('./nonexistent.yaml')
        expect(config).toEqual({})
    })
})
