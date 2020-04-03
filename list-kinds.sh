#!/bin/bash

sed $1 -n -r -e 's/^.*"kind" *: *"([^"]+)".*$/\1/p' | sort | uniq
