#!/bin/sh

rm -r ../svgcraft.github.io/* && \
  cp -r img touchnavi *.js *.json *.html *.css AUTHORS LICENSE ../svgcraft.github.io/ && \
  mkdir ../svgcraft.github.io/gallery && \
  cp ./gallery/*.svg ../svgcraft.github.io/gallery/
