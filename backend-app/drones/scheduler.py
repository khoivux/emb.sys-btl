import json
import logging
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler(timezone='Asia/Ho_Chi_Minh')


def execute_scheduled_mission(mission_id):
    """Worker được APScheduler gọi khi tới giờ hẹn."""
    # Import ở đây để tránh circular import (Django chưa fully loaded khi module được import)
    from .models import ScheduledMission
    from .mqtt_service import get_mqtt_service

    try:
        mission = ScheduledMission.objects.get(id=mission_id)
        if mission.status != 'PENDING':
            logger.warning(f"[Scheduler] Mission {mission_id} đã ở trạng thái {mission.status}, bỏ qua.")
            return

        targets = mission.targets_json
        mqtt_messages = []

        for t in targets:
            drone_id = t.get('drone_id')
            mqtt_messages.append({
                'topic': f"drone/{drone_id}/command",
                'payload': json.dumps({
                    "type": "GOTO",
                    "params": {"lat": t["lat"], "lng": t["lng"]}
                }),
            })

        if mqtt_messages:
            get_mqtt_service().publish_batch(mqtt_messages)
            mission.status = 'EXECUTED'
            mission.save()
            logger.info(f"[Scheduler] Đã thực thi Mission #{mission_id} — {len(mqtt_messages)} drone(s) nhận lệnh.")
        else:
            mission.status = 'FAILED'
            mission.save()
            logger.error(f"[Scheduler] Mission #{mission_id} thất bại — không có target hợp lệ.")

    except ScheduledMission.DoesNotExist:
        logger.error(f"[Scheduler] Mission #{mission_id} không tìm thấy trong DB.")
    except Exception as e:
        logger.error(f"[Scheduler] Lỗi khi thực thi Mission #{mission_id}: {e}")
        try:
            mission = ScheduledMission.objects.get(id=mission_id)
            mission.status = 'FAILED'
            mission.save()
        except Exception:
            pass


def start():
    """Khởi động BackgroundScheduler nếu chưa chạy."""
    if not scheduler.running:
        scheduler.start()
        logger.info("[Scheduler] APScheduler đã khởi động.")
