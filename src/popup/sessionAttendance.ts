interface SessionInfo {
  startTime: string
  name: string
  required: boolean
  students: { presence?: any; absence?: { excused: any } }[]
}
interface Student {
  lastName: string
  firstName: string
}
interface Session {
  meeting: {
    startTime: string
    endTime: string
    id: string
  }
}

let sessions: Session[] = []
let students: Student[] = []
let sessionsInfo: SessionInfo[] = []

export default async function main(
  headers: Headers,
  courseId: string,
  dataUrl: string,
  referrerUrl: string,
) {
  const [sessionsResponse, studentsResponse] = await Promise.all([
    fetch(`${dataUrl}/sessions`, {
      headers,
      referrer: referrerUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: `{\"courseId\":${courseId}}`,
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
    }),
    fetch(`${dataUrl}/students`, {
      headers,
      referrer: referrerUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: `{\"courseId\":${courseId}}`,
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
    }),
  ])

  sessions = await sessionsResponse.json()
  students = await studentsResponse.json()

  sessionsInfo = await getSessionsInfo(sessions, headers, dataUrl, referrerUrl)

  outputAttendanceCsv(sessionsInfo, students)
}

async function getSessionsInfo(
  sessions: Session[],
  headers: Headers,
  dataUrl: string,
  referrerUrl: string,
) {
  const NOW = Date.now()
  let sessionRequests = []
  for (let i = sessions.length - 1; i >= 0; i--) {
    // Check for sessions that haven't happened yet
    const endTime = new Date(sessions[i].meeting.endTime).getTime()
    if (endTime > NOW) {
      continue
    }

    const meetingId = sessions[i].meeting.id
    sessionRequests.push(getSessionInfo(meetingId, headers, dataUrl, referrerUrl))
  }

  const sessionsInfo = await Promise.all(sessionRequests)

  return sessionsInfo
}

async function getSessionInfo(
  meetingId: string,
  headers: Headers,
  dataUrl: string,
  referrerUrl: string,
) {
  const response = await fetch(`${dataUrl}/session`, {
    headers,
    referrer: referrerUrl,
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: `{\"meetingId\":${meetingId}}`,
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
  })
  const session = await response.json()
  return session
}

function convertStudentsToCsv(students: Student[]) {
  let studentsNames: string[] = []
  students.forEach((student) => {
    studentsNames.push(`"${student.lastName}, ${student.firstName}"`)
  })
  return studentsNames.join(',')
}

function convertSessionToCsvRow(sessionInfo: SessionInfo) {
  const { startTime, name, students, required } = sessionInfo
  const studentAttendance: string[] = []
  students.forEach((student) => {
    if (student.presence) {
      studentAttendance.push('Present')
    } else if (student.absence) {
      if (student.absence.excused) {
        studentAttendance.push('Excused')
      } else {
        studentAttendance.push('Absent')
      }
    }
  })

  return `${startTime},"${name}",${studentAttendance.join(',')}\n`
}

function outputAttendanceCsv(sessionsInfo: SessionInfo[], students: Student[]) {
  const studentsCsv = convertStudentsToCsv(students)
  let csvOutput = `Date,Class Name,${studentsCsv}\n`

  sessionsInfo.forEach((session) => {
    const row = convertSessionToCsvRow(session)
    csvOutput = `${csvOutput}${row}`
  })

  console.log('\n\nRaw CSV output:')
  console.log(`%c${csvOutput}`, 'color:blue')
  try {
    if (navigator?.clipboard) {
      navigator?.clipboard?.writeText?.(csvOutput)
      console.log(`%cCSV values copied to clipboard!👍`, 'color:green; font-weight:bold;')
    }
  } catch (err) {
    console.error('Error copying cvs to clipboard')
  }
}
