import mqtt from "mqtt"; 

const DEMAND_SUFFIX = "demand"
const POTENTIAL_SUFFIX = "potential"
const SETPOINT_SUFFIX = "setPoint"
const ENERGY_STORAGE_SUFFIX = "storageSetPoint"
const MEASUREMENT_SUFFIX = "measurement"

type setPoint = {
    setPoint: number;
}

type energyStorageSetPoint = {
    chargeSetPoint: number;
    dischargeSetPoint: number;
}

type NodeCallback = {
    (setPoint: number): void;
};

type EnergyStorageCallback = {
    (chargeSetPoint: number, dischargeSetPoint: number): void;
};

export class MQTTConnector {

    client: mqtt.MqttClient | undefined;
    callbacks = new Map<string, NodeCallback | EnergyStorageCallback>() 

    connect(url: string) {
        console.log(`connecting to MQTT broker ${url}`)
        this.client = mqtt.connect(url);

        this.client.on("connect", () => {
            console.log("connected to MQTT broker")
        });

        this.client.on("message", (topic, message) => {
            const callback = this.callbacks.get(topic)

            if (callback != undefined) {
                if (topic.endsWith(SETPOINT_SUFFIX)) {
                    const msg: setPoint = JSON.parse(message.toString());
                    (callback as NodeCallback)(msg.setPoint);
                } else if (topic.endsWith(ENERGY_STORAGE_SUFFIX)) {
                    const msg: energyStorageSetPoint = JSON.parse(message.toString());
                    (callback as EnergyStorageCallback)(msg.chargeSetPoint, msg.dischargeSetPoint);
                }
            }
        })
    }

    publishDemand(nodeId: string, demand: number) {
        this.client?.publish(`${nodeId}/${DEMAND_SUFFIX}`, JSON.stringify({demand: demand}))
    }

    publishPotential(nodeId: string, chargePotential: number, dischargePotential: number) {
        this.client?.publish(`${nodeId}/${POTENTIAL_SUFFIX}`, JSON.stringify({chargePotential: chargePotential, dischargePotential: dischargePotential}))
    }

    publishPowerMeasurement(nodeId: string, measurement: number) {
        this.client?.publish(`${nodeId}/${MEASUREMENT_SUFFIX}`, JSON.stringify({measurement: measurement}))
    }

    subscribe(nodeId: string, callback: NodeCallback | EnergyStorageCallback, topicSuffix: string) {
        const topic = `${nodeId}/${topicSuffix}`
        this.callbacks.set(topic, callback)
        this.client?.subscribe(topic)
    }

    unsubscribe(nodeId: string, topicSuffix: string) {
        const topic = `${nodeId}/${topicSuffix}`
        this.client?.unsubscribe(topic)
        this.callbacks.delete(topic)
    }

    subscribeSetPoint(nodeId: string, callback: NodeCallback) {
        this.subscribe(nodeId, callback, SETPOINT_SUFFIX)
    }

    unsubscribeSetPoint(nodeId: string) {
        this.unsubscribe(nodeId, SETPOINT_SUFFIX)
    }

    subscribeEnergyStorageSetPoint(nodeId: string, callback: EnergyStorageCallback) {
        this.subscribe(nodeId, callback, ENERGY_STORAGE_SUFFIX)
    }

    unsubscribeEnergyStorageSetPoint(nodeId: string) {
        this.unsubscribe(nodeId, ENERGY_STORAGE_SUFFIX)
    }

    disconnect() {
        this.client?.end()
        this.client = undefined
    }
}