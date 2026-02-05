import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class JobsEventsService {
  private readonly subjects = new Map<string, Subject<MessageEvent>>();

  getSubject(jobId: string) {
    if (!this.subjects.has(jobId)) {
      this.subjects.set(jobId, new Subject());
    }
    return this.subjects.get(jobId)!;
  }

  emit(jobId: string, data: MessageEvent['data']) {
    const subject = this.getSubject(jobId);
    subject.next({ data });
  }

  complete(jobId: string) {
    const subject = this.subjects.get(jobId);
    if (subject) {
      subject.complete();
      this.subjects.delete(jobId);
    }
  }
}
