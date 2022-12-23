#!/bin/sh

# https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/enwiki-2022-08-29.txt
INP=~/Downloads/enwiki-2022-08-29.txt
OUTP="./src/wordlist.js"

echo "function wordlist() {" > $OUTP
echo "  return [" >> $OUTP
head -n 5000 $INP | sed -E -e 's/ [0-9]+$/",/g' -e 's/^/"/g' | grep -E -e '^"[a-z]+",$' | grep -v -e '^"ii",$' -e '^"iii",$' -e '^"iv",$' >> $OUTP
echo "  ];" >> $OUTP
echo "}" >> $OUTP
