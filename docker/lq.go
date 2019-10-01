// The entry point of the Loquacious docker image.
//
// If a config file is given via a volume mount at /lq/config.ts, the file will be used.
// Otherwise it will be generated with some optional variables.
//
// Similarly if a Caddyfile is given at /lq/Caddyfile it will be used,
// otherwise there are variables that are required.
package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"
	"text/template"

	"github.com/alecthomas/kong"
	"github.com/pkg/errors"
)

type Vars struct {
	ESProxy             bool     `env:"ES_PROXY" default:"true" help:"Use a reverse proxy for ElasticSearch to avoid needing CORS. (ES_PROXY)"`
	ESURL               string   `env:"ES_URL" name:"es-url" help:"ElasticSearch host to send queries to, e.g.: http://my-es-server:9200/ (ES_URL)"`
	ESIndex             string   `env:"ES_INDEX" default:"*" help:"ElasticSearch index to search in. (ES_INDEX)"`
	TimestampField      string   `env:"TIMESTAMP_FIELD" default:"@timestamp" help:"The field containing the main timestamp entry. (TIMESTAMP_FIELD)"`
	LevelField          string   `env:"LEVEL_FIELD" default:"level" help:"The field containing the log level. (LEVEL_FIELD)"`
	ServiceField        string   `env:"SERVICE_FIELD" default:"service" help:"The field containing the name of the service. (SERVICE_FIELD)"`
	MessageField        string   `env:"MESSAGE_FIELD" default:"message" help:"The field containing the main message of the log entry. (MESSAGE_FIELD)"`
	IgnoredFields       []string `env:"IGNORED_FIELDS" default:"_id,_index" help:"Do not display these fields in the collapsed log line. (IGNORED_FIELDS)"`
	IgnoredFieldsJoined string   `hidden:""`
}

const lqConfigFile = "config.json"
const caddyFile = "Caddyfile"

func main() {
	err := run()
	if err != nil {
		log.Fatalf("%+v\n", err)
	}
}

func run() error {
	vars := Vars{}
	kong.Parse(&vars)
	log.Printf("Variables for this docker image looks like this:\n%+v", vars)

	if !exists(dstPath(caddyFile)) && vars.ESURL == "" {
		return errors.Errorf("%s is missing and ES_URL (--es-url) was not specified.", caddyFile)
	}

	vars.IgnoredFieldsJoined = fmt.Sprintf(`"%s"`, strings.Join(vars.IgnoredFields, `","`))

	err := tmpl(caddyFile, vars)
	if err != nil {
		return err
	}

	err = tmpl(lqConfigFile, vars)
	if err != nil {
		return err
	}

	log.Printf("Running caddy...")
	err = stream("caddy")
	if err != nil {
		return errors.Wrapf(err, "caddy exited unusually")
	}

	return nil
}

func dstPath(name string) string {
	return fmt.Sprintf("/lq/%s", name)
}

func tmpl(name string, vars Vars) error {
	src := fmt.Sprintf("/templates/%s", name)
	dst := dstPath(name)
	if exists(dst) {
		return nil
	}

	t, err := template.New(path.Base(src)).ParseFiles(src)
	if err != nil {
		panic(err)
	}

	fp, err := os.Create(dst)
	if err != nil {
		return errors.Wrapf(err, "could not create %s", dst)
	}

	err = t.Execute(fp, &vars)
	if err != nil {
		return errors.Wrapf(err, "could not execute template %s", dst)
	}

	log.Print("Successfully generated", dst)
	return nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func stream(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
