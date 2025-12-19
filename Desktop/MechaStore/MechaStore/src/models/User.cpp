#include "User.h"
#include <iostream>
using namespace std;


User::User() : cms_id(0), isAdmin(false) {}


User::User(int id, string username, string password, string whatsapp_no, bool isAdminFlag)
: cms_id(id), username(username), password(password), whatsapp_no(whatsapp_no), isAdmin(isAdminFlag) {}


const int User::getId() const { return cms_id; }
const string User::getUserName() const { return username; }
const string User::getPassword() const { return password; }
bool User::getisAdmin() const { return isAdmin; }
string User::getWhatsapp() const{ return whatsapp_no; }


void User::setWhatsapp(string whatsapp) { whatsapp_no = whatsapp; }
bool User::verifyPassword(string input) const { return input == password; }


