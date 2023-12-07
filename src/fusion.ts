import { createSession } from './got-utils.js'

export async function login(user: string, password: string): Promise<string> {
  const session = createSession()

  const calendar = await session
    .get(
      'https://api.fusionacademy.com/api/schedule/webcal?studentIds=0036T00004MKNYDQA5&key=61a70d35a522601be6e8f59cd09518136e3967da14ebae96b6dad58abaf54df0',
    )
    .text()

  // transform the calendar to the way we want it
  const vcal = fromICS(calendar)
  vcal.properties.NAME = 'Fusion Academy'
  vcal.properties['PRODID'] = 'fusion/0.1.0' // take from package.json
  delete vcal.properties.DESCRIPTION
  delete vcal.properties['REFRESH-INTERVAL']
  delete vcal.properties['X-PUBLISHED-TTL']
  delete vcal.properties['X-WR-CALDESC']
  delete vcal.properties['X-WR-CALNAME']
  vcal.properties.VEVENT = (vcal.properties.VEVENT as CalendarObject[])
    .filter((vevent) => {
      // skip cancelled classes
      if (vevent.properties.STATUS === 'CANCELLED') {
        return false
      }
      return true
    })
    .map((vevent) => {
      // trim 10m off everything
      if (
        typeof vevent.properties.DTEND === 'string' &&
        vevent.properties.DTEND.endsWith('3000Z')
      ) {
        vevent.properties.DTEND = vevent.properties.DTEND.replace(/3000Z$/, '2000Z')
      }
      // remove any trailing " (Juliette)"
      if (typeof vevent.properties.SUMMARY === 'string') {
        vevent.properties.SUMMARY = vevent.properties.SUMMARY.replace(/ \(Juliette\)$/, '')
      }
      // add a location
      vevent.properties.LOCATION = '30700 Russell Ranch Rd #180, Westlake Village, CA 91362'
      // ignore categories/color set by fusion
      delete vevent.properties.CATEGORIES
      delete vevent.properties.COLOR
      return vevent
    })

  return toICS(vcal)
}

type CalendarObject = {
  type: string
  properties: Record<string, string | CalendarObject[] | undefined>
}

function fromICS(calendar: string): CalendarObject {
  const stack: CalendarObject[] = [{ type: 'root', properties: {} }]

  for (const line of calendar.split(/\r\n|\n|\r/)) {
    const [key, value] = line.split(':')

    switch (key) {
      case 'BEGIN':
        stack.push({ type: value, properties: {} })
        break
      case 'END': {
        const obj = stack.pop()
        if (!obj) throw new Error('Unexpected END')

        const parent = stack[stack.length - 1]
        if (!parent) throw new Error('Unbalanced BEGIN/END')

        const collection = (parent.properties[obj.type] ??= [])
        if (!Array.isArray(collection)) throw new Error('Parent cannot collect ' + obj.type)

        if (Array.isArray(parent.properties[obj.type])) {
          collection.push(obj)
        }
        break
      }
      default:
        const obj = stack[stack.length - 1]
        if (!obj) throw new Error('Unexpected property')
        obj.properties[key] = value
    }
  }

  if (stack.length !== 1) {
    throw new Error('Unbalanced BEGIN/END')
  }

  if (!Array.isArray(stack[0].properties.VCALENDAR) || stack[0].properties.VCALENDAR.length !== 1) {
    throw new Error('More than one VCALENDAR')
  }

  return stack[0].properties.VCALENDAR[0]
}

function toICS(calendar: CalendarObject): string {
  let str = 'BEGIN:' + calendar.type + '\r\n'
  for (const [key, value] of Object.entries(calendar.properties)) {
    if (!Array.isArray(value)) {
      str += key + ':' + value + '\r\n'
    }
  }
  for (const [key, value] of Object.entries(calendar.properties)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        str += toICS(child)
      }
    }
  }
  str += 'END:' + calendar.type + '\r\n'
  return str
}
