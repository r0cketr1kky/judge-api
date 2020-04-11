import { Request, Response } from 'express'
import { RunJob, queueJob } from 'rabbitmq/jobqueue'
import DB from 'models'
import { normalizeRunJob } from 'utils'
import { upload } from 'utils/s3'
import axios from 'axios'

type RunResponse = {
  id: number,
  stdout: string,
  stderr: string,
  time: number,
  code: number
}
type RunPoolElement = {
  res: Response
}

const RunPool: { [x: number]: RunPoolElement } = {}

class RunController {
  async RunPOST(req: Request, res: Response) {
    const mode = req.body.mode || 'sync'
    const job = await DB.submissions.create({
      lang: req.body.lang,
      start_time: new Date(),
      mode,
      callback: req.body.callback
    })

    const runJob: RunJob = await normalizeRunJob({
      id: job.id,
      source: req.body.source,
      lang: req.body.lang,
      stdin: req.body.stdin,
      timelimit: req.body.timelimit
    }, req.body.enc)

    await queueJob(runJob)

    if (['callback', 'poll'].includes(mode)) {
      return res.json({
        id: job.id
      })
    }

    // if mode === 'sync'
    RunPool[job.id] = {
      res
    }
  }

  async onSuccess(result: RunResponse) {
    const { url } = await upload(result)

    const job = await DB.submissions.findById(result.id)
    job.outputs = [url]
    await job.save()

    switch (job.mode) {
      case 'callback':
        await axios.post(job.callback, result)
        break
      case 'sync':
        RunPool[job.id].res.json(result)
        break
    }
  }
}

export default new RunController()