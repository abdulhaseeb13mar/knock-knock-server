import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class CampaignsEventsService {
  private readonly subjects = new Map<string, Subject<MessageEvent>>();

  getSubject(campaignId: string) {
    if (!this.subjects.has(campaignId)) {
      this.subjects.set(campaignId, new Subject());
    }
    return this.subjects.get(campaignId)!;
  }

  emit(campaignId: string, data: MessageEvent['data']) {
    const subject = this.getSubject(campaignId);
    subject.next({ data });
  }

  complete(campaignId: string) {
    const subject = this.subjects.get(campaignId);
    if (subject) {
      subject.complete();
      this.subjects.delete(campaignId);
    }
  }
}
