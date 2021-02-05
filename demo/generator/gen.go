package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/pkg/errors"
)

func main() {
	baseURL := "http://es:9200/"
	docURL := fmt.Sprintf("%stest/_doc/", baseURL)
	err := waitForResponsiveServer(baseURL, time.Now().Add(1 * time.Minute))
	if err != nil {
		panic(err)
	}

	backfill, ok := os.LookupEnv("BACKFILL")
	if ok && backfill == "1" {
		go backFill(docURL)
	}
	liveFill(docURL)
}

func waitForResponsiveServer(url string, timeout time.Time) error {
	for time.Now().Before(timeout) {
		log.Printf("Waiting for ES to show up at %s", url)
		time.Sleep(time.Second)

		resp, err := http.Get(url)
		if err != nil {
			err = errors.Wrapf(err, "could not get %s", url)
			continue
		}

		if resp.StatusCode == 200 {
			return nil
		}
	}

	return errors.New("timed out waiting for ES to respond")
}

func backFillJob(url string, payloads chan *bytes.Buffer) {
	for payload := range payloads {
		resp, err := http.Post(url, "application/json", payload)
		if err != nil {
			log.Printf("could not send request: %+v", err)
			continue
		}
		_ = resp.Body.Close()
	}
}

func backFill(url string) {
	queue := make(chan *bytes.Buffer)
	for i := 0; i < 8; i++ {
		go backFillJob(url, queue)
	}

	timeMachine := time.Now()
	limit := timeMachine.Add(-time.Hour * 24 * 2)
	nextCheckDelta, duration := newDurations()
	nextCheck := timeMachine.Add(-nextCheckDelta)

	for timeMachine.After(limit) {
		timeMachine = timeMachine.Add(-duration)

		payload, err := genPayload(timeMachine)
		if err != nil {
			log.Printf("could not send request: %+v", err)
			continue
		}
		queue <- payload

		// To create a more interesting histogram, every so often we change the sleep interval
		if timeMachine.Before(nextCheck) {
			nextCheckDelta, duration = newDurations()
			nextCheck = timeMachine.Add(-nextCheckDelta)
		}
	}

	close(queue)
}

func liveFill(url string) {
	nextCheckDuration, duration := newDurations()
	nextCheck := time.Now().Add(nextCheckDuration)

	for {
		time.Sleep(duration)

		payload, err := genPayload(time.Now())
		if err != nil {
			log.Printf("could not send request: %+v", err)
			continue
		}

		resp, err := http.Post(url, "application/json", payload)
		if err != nil {
			log.Printf("could not send request: %+v", err)
			continue
		}
		_ = resp.Body.Close()

		// To create a more interesting histogram, every so often we change the sleep interval
		if time.Now().After(nextCheck) {
			nextCheckDuration, duration = newDurations()
			nextCheck = time.Now().Add(nextCheckDuration)
		}
	}
}

// newDurations returns newCheck which is when the next call to newDurations should be made.
func newDurations() (nextCheck time.Duration, duration time.Duration) {
	// Between 100ms and 5s
	duration = time.Millisecond * time.Duration(100*(1+rand.Int()%50))
	nextCheck = time.Second * time.Duration(rand.Int()%120)
	log.Printf("Duration: %s Next Change: %s", duration, nextCheck)
	return
}

type Payload struct {
	Timestamp string `json:"@timestamp"`
	Service   string `json:"service"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Power     int    `json:"power,omitempty"`
	Dexterity int    `json:"dexterity,omitempty"`
	Charge    struct {
		Attack   int
		Strength int
	} `json:"charge,omitempty"`
}

func genPayload(when time.Time) (*bytes.Buffer, error) {
	payload := Payload{
		Timestamp: when.UTC().Format("2006-01-02T15:04:05-0700"),
	}

	switch rand.Int() % 4 {
	case 0:
		payload.Level = "INFO"
		payload.Message = fmt.Sprintf("A descriptive info message %d", rand.Int())
	case 1:
		payload.Level = "DEBUG"
		payload.Message = fmt.Sprintf("%d is debugging %d and %d", rand.Int()%5, rand.Int()%10000, rand.Int()%10000)
	case 2:
		payload.Level = "ERROR"
		payload.Message = fmt.Sprintf("error running process %d with command %d", rand.Int()%32767, rand.Int())
	case 3:
		payload.Level = "INFO"
		payload.Message = fmt.Sprintf("<!DOCTYPE html><html><head><title>Error: 404</title><style type=\"text/css\">body{background-color:#fff;color:#666;text-align:center;font-family:arial,sans-serif}div.dialog{width:25em;padding:0 4em;margin:4em auto 0 auto;border:1px solid #ccc;border-right-color:#999;border-bottom-color:#999}h1{font-size:100%;color:#f00;line-height:1.5em}</style></head><body><div class=\"dialog\"><h1>Test HTML Escaping</h1><p>This is a test for if HTML gets logged</p></div></body></html>")
	}

	switch rand.Int() % 5 {
	case 0:
		payload.Service = "shredder"
	case 1:
		payload.Service = "flipper"
	case 2:
		payload.Service = "tainter"
	case 3:
		payload.Service = "mover"
	case 4:
		payload.Service = "crusher"
	}

	if rand.Int()%2 == 0 {
		payload.Charge = struct {
			Attack   int
			Strength int
		}{Attack: rand.Int() % 100, Strength: rand.Int() % 100}
	}
	if rand.Int()%2 == 0 {
		payload.Power = rand.Int() % 10
	}
	if rand.Int()%3 == 0 {
		payload.Dexterity = rand.Int() % 10
	}

	log.Printf("%+v", payload)

	buf := &bytes.Buffer{}
	err := json.NewEncoder(buf).Encode(&payload)
	return buf, err
}
