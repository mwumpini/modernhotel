/**
 * Writes the on-premises guide and the cloud-and-premises guide into dist.
 * Run: node scripts/setup-guide-pdf.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { jsPDF } = require('jspdf')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

const teal = [11, 95, 100]
const tealMid = [14, 124, 128]
const gold = [233, 162, 59]
const ink = [23, 23, 23]
const muted = [75, 85, 90]

const iconSteps = [
  {
    title: 'Android',
    lines: [
      'Open the chosen address in Chrome.',
      'Tap the menu, then Add to Home screen.',
      'The AGM Sync icon opens that hotel page.',
    ],
  },
  {
    title: 'iPhone, iPad, and tablet',
    lines: [
      'Open the chosen address in Safari.',
      'Tap Share, then Add to Home Screen.',
      'The AGM Sync icon opens that hotel page.',
    ],
  },
  {
    title: 'Windows and Mac',
    lines: [
      'On Windows, open the chosen address in Chrome or Edge, then Create shortcut or Apps then Install.',
      'On a Mac, use Safari File then Add to Dock, or Chrome Create shortcut.',
      'The AGM Sync icon opens that hotel page.',
    ],
  },
]

function drawMark(doc, x, y) {
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(x, y, 14, 14, 3, 3, 'F')
  doc.setFillColor(...gold)
  doc.roundedRect(x + 5.2, y + 6.2, 3.2, 5.2, 1.4, 1.4, 'F')
}

function startGuide(doc, title, subtitle) {
  const pageW = 210
  doc.setFillColor(...teal)
  doc.rect(0, 0, pageW, 46, 'F')
  doc.setFillColor(...gold)
  doc.rect(0, 46, pageW, 2.2, 'F')
  drawMark(doc, 16, 10)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('AGM Sync', 34, 16.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Your property, simply connected.', 34, 22.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, 16, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(subtitle, 16, 42)
  return 58
}

function footer(doc, label) {
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.4)
  doc.line(16, 284, 194, 284)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...muted)
  doc.text(label, 16, 289)
  doc.text('AGM Sync', 194, 289, { align: 'right' })
}

function ensureRoom(doc, y, needed, title) {
  if (y + needed < 276) return y
  footer(doc, title)
  doc.addPage()
  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(title, 16, 9)
  return 24
}

function paragraph(doc, y, text, title) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  const lines = doc.splitTextToSize(text, 178)
  y = ensureRoom(doc, y, lines.length * 5 + 4, title)
  doc.setTextColor(...muted)
  doc.text(lines, 16, y)
  return y + lines.length * 5 + 4
}

function callout(doc, y, text, title) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const lines = doc.splitTextToSize(text, 170)
  const height = 8 + lines.length * 5
  y = ensureRoom(doc, y, height + 4, title)
  doc.setFillColor(245, 247, 247)
  doc.roundedRect(16, y, 178, height, 2, 2, 'F')
  doc.setTextColor(...tealMid)
  doc.text(lines, 20, y + 6)
  return y + height + 6
}

function steps(doc, y, items, title) {
  items.forEach((step, index) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    const wrapped = step.lines.map((line, lineIndex) =>
      doc.splitTextToSize(`${lineIndex + 1}.  ${line}`, 167),
    )
    const height = 12 + wrapped.reduce((sum, line) => sum + line.length * 5, 0)
    y = ensureRoom(doc, y, height, title)
    doc.setFillColor(...teal)
    doc.circle(20, y + 3.2, 3.4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(String(index + 1), 20, y + 4.4, { align: 'center' })
    doc.setTextColor(...ink)
    doc.setFontSize(12)
    doc.text(step.title, 27, y + 4.4)
    let lineY = y + 11
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(...muted)
    wrapped.forEach((line) => {
      doc.text(line, 27, lineY)
      lineY += line.length * 5
    })
    y = lineY + 4
  })
  return y
}

function writeGuide({ file, title, subtitle, intro, note, sections, footerLabel }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = startGuide(doc, title, subtitle)
  y = paragraph(doc, y, intro, title)
  if (note) y = callout(doc, y, note, title)
  sections.forEach((section) => {
    y = ensureRoom(doc, y, 12, title)
    doc.setTextColor(...ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(section.heading, 16, y)
    y += 6
    if (section.text) y = paragraph(doc, y, section.text, title)
    y = steps(doc, y, section.steps, title)
  })
  footer(doc, footerLabel)
  const out = path.join(dist, file)
  fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
  console.log(out)
}

fs.mkdirSync(dist, { recursive: true })

writeGuide({
  file: 'AGMSync-Setup-Guide-On-Premises.pdf',
  title: 'On-premises setup',
  subtitle: 'One computer is the hotel server. The other devices join it on Wi-Fi.',
  intro: 'Run the setup on the computer that stays in the hotel. Phones, tablets, and other computers on that same Wi-Fi open the address shown on its sign-in page. They share the records on that computer. The internet can be down.',
  note: 'Use the address on the hotel computer sign-in page. It looks like http://192.168.x.x:3000.',
  footerLabel: 'On-premises only',
  sections: [
    {
      heading: 'Hotel computer',
      steps: [
        {
          title: 'Install',
          lines: [
            'Run AGMSync-Setup.exe on the computer that stays on.',
            'The AGM Sync icon opens the hotel on that computer. No black window stays open.',
            'On the sign-in page, note the address.',
          ],
        },
        {
          title: 'Other devices',
          lines: [
            'Put every phone, tablet, and other computer on the same Wi-Fi.',
            'Open the address from the sign-in page on each device and sign in.',
            'This computer must stay on. Closing it stops the other devices.',
          ],
        },
      ],
    },
    {
      heading: 'Save an icon',
      text: 'On each device, save the on-premises address. The icon opens this hotel computer.',
      steps: iconSteps,
    },
  ],
})

writeGuide({
  file: 'AGMSync-Setup-Guide-Cloud-and-Premises.pdf',
  title: 'Cloud and on-premises',
  subtitle: 'The hotel computer and the cloud keep the same records.',
  intro: 'Run AGMSync-Cloud-Premises-Setup.exe on the computer that stays in the hotel. Link it with the hotel code and the cloud sign-in. A change at home shows in the hotel. A change in the hotel shows at home. When the internet is down, the hotel computer keeps working, and the changes catch up when it returns.',
  note: 'In the hotel, open the address on the sign-in page. Away from the hotel, open https://app.agmsync.com. Both show the same records after a sync.',
  footerLabel: 'Cloud and on-premises',
  sections: [
    {
      heading: 'On the premises',
      text: 'The computer that runs the setup is the server for the building. The internet can be down.',
      steps: [
        {
          title: 'Hotel computer',
          lines: [
            'Run AGMSync-Cloud-Premises-Setup.exe on the computer that stays on.',
            'Close any other AGM Sync window first. The icon opens the link page, then the hotel.',
            'Enter the hotel code, email, and password from the cloud sign-in.',
          ],
        },
        {
          title: 'Devices in the hotel',
          lines: [
            'Join the same Wi-Fi.',
            'Open the address from the sign-in page and sign in.',
            'Save that address as the icon. It opens the hotel computer.',
          ],
        },
      ],
    },
    {
      heading: 'On the cloud',
      text: 'Someone at home opens https://app.agmsync.com. That needs the internet. The hotel computer sends and receives changes while its internet is up. If both sides change the same record before they connect, the later change is the one that remains.',
      steps: [
        {
          title: 'Cloud icon',
          lines: [
            'Open https://app.agmsync.com in the browser.',
            'Save that page as an icon with the steps below.',
            'A person in the hotel can use this address or the hotel address. After a sync, both show the same records.',
          ],
        },
      ],
    },
    {
      heading: 'Save the icon you chose',
      steps: iconSteps,
    },
  ],
})

fs.rmSync(path.join(dist, 'AGMSync-Setup-Guide.pdf'), { force: true })
